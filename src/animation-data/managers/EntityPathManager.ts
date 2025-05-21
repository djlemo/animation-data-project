import { FileReader } from '../loaders/FileReader.interface';
import { 
    EntityPathBatch, 
    EntityPathDataFileInfo, 
    EntityPath,
    PathPoint
} from '../interfaces';
import { CacheManager } from './CacheManager';
import { ReplicationManager } from './ReplicationManager';

/**
 * Manages entity path data loading and querying
 */
export class EntityPathManager {
    /** File reader implementation */
    private reader: FileReader;
    
    /** Cache manager for JSON data */
    private cacheManager: CacheManager;
    
    /** Replication manager for accessing active replication data */
    private replicationManager: ReplicationManager;
    
    /** Map of loaded entity path batches by file path */
    private loadedEntityPathBatches: Map<string, EntityPathBatch> = new Map();
    
    /** Map of entity IDs to their paths (for quick lookup) */
    private entityPathsById: Map<string, EntityPath> = new Map();
    
    /** 
     * Timeline index for efficient lookup of entities by time
     * Maps time bucket keys to sets of entity IDs active during that time bucket
     */
    private timelineIndex: Map<string, Set<string>> = new Map();
    
    /**
     * Creates a new EntityPathManager instance
     * 
     * @param reader File reader to use for loading data
     * @param cacheManager Cache manager for JSON data
     * @param replicationManager Replication manager for accessing active replication data
     */
    constructor(
        reader: FileReader, 
        cacheManager: CacheManager,
        replicationManager: ReplicationManager
    ) {
        this.reader = reader;
        this.cacheManager = cacheManager;
        this.replicationManager = replicationManager;
    }
    
    /**
     * Loads an entity path batch file
     * 
     * @param fileInfo Information about the entity path file to load
     * @returns Promise resolving to the loaded batch, or undefined if loading failed
     */
    public async loadEntityPathBatch(fileInfo: EntityPathDataFileInfo): Promise<EntityPathBatch | undefined> {
        // Check if already loaded
        if (this.loadedEntityPathBatches.has(fileInfo.filePath)) {
            return this.loadedEntityPathBatches.get(fileInfo.filePath);
        }
        
        // Load and parse the batch file
        const batchData = await this.cacheManager.fetchAndParseJSON<EntityPathBatch>(fileInfo.filePath);
        
        if (!batchData) {
            console.error(`EntityPathManager: Failed to load entity path batch from ${fileInfo.filePath}`);
            return undefined;
        }
        
        // Store in our loaded batches map
        this.loadedEntityPathBatches.set(fileInfo.filePath, batchData);
        
        // Convert entities to EntityPath objects and add to our map
        for (const entity of batchData.entities) {
            const entityPath: EntityPath = {
                entityId: entity.id,
                type: entity.type,
                path: entity.path.map((point: { time: any; x: any; y: any; activity: any; state: any; }) => ({
                    clock: point.time,
                    x: point.x,
                    y: point.y,
                    event: point.activity || undefined,
                    state: point.state
                }))
            };
            this.entityPathsById.set(entity.id, entityPath);
        }
        
        // Update the timeline index with the converted paths
        this.updateTimelineIndex(Array.from(this.entityPathsById.values()));
        
        return batchData;
    }
    
    /**
     * Updates the timeline index with new entity paths
     * 
     * @param entityPaths Entity paths to add to the index
     */
    private updateTimelineIndex(entityPaths: EntityPath[]): void {
        const BUCKET_SIZE = 10; // Time bucket size in simulation time units
        
        for (const entityPath of entityPaths) {
            if (entityPath.path.length === 0) continue;
            
            const firstPoint = entityPath.path[0];
            const lastPoint = entityPath.path[entityPath.path.length - 1];
            
            // Calculate which buckets this entity spans
            const startBucket = Math.floor(firstPoint.clock / BUCKET_SIZE);
            const endBucket = Math.floor(lastPoint.clock / BUCKET_SIZE);
            
            // Add this entity to all buckets it spans
            for (let bucket = startBucket; bucket <= endBucket; bucket++) {
                const key = `bucket_${bucket}`;
                
                if (!this.timelineIndex.has(key)) {
                    this.timelineIndex.set(key, new Set<string>());
                }
                
                // Fix: Check if entityId is a function and call it if it is, otherwise use it as a property
                const entityId = typeof entityPath.entityId === 'function' 
                    ? entityPath.entityId(entityPath) 
                    : entityPath.entityId;
                
                this.timelineIndex.get(key)!.add(entityId as string);
            }
        }
    }
    
    /**
     * Pre-processes entity paths for faster access
     * This builds indexes and data structures to optimize lookups
     */
    public preprocessEntityPaths(): void {
        // Clear existing timeline index
        this.timelineIndex.clear();
        
        // Rebuild the timeline index with all loaded entity paths
        this.updateTimelineIndex(Array.from(this.entityPathsById.values()));
    }
    
    /**
     * Clears all loaded entity path data
     */
    public clearEntityPathData(): void {
        this.loadedEntityPathBatches.clear();
        this.entityPathsById.clear();
        this.timelineIndex.clear();
    }
    
    /**
     * Loads entity path data for the active replication
     * 
     * @returns Promise resolving to true if successful, false otherwise
     */
    public async loadEntityPathDataForActiveReplication(): Promise<boolean> {
        const activeReplication = this.replicationManager.getActiveReplication();
        if (!activeReplication) {
            return false;
        }
        
        // Clear any existing entity path data
        this.clearEntityPathData();
        
        // Check if there are any entity path data files to load
        if (!activeReplication.entityPathDataFiles || activeReplication.entityPathDataFiles.length === 0) {
            console.log(`No entity path data files found for replication ${this.replicationManager.getActiveReplicationId()}`);
            return true;
        }
        
        // Load each entity path batch file
        const loadPromises = activeReplication.entityPathDataFiles.map(fileInfo => 
            this.loadEntityPathBatch(fileInfo)
        );
        
        await Promise.all(loadPromises);
        
        // Pre-process entity paths for faster access
        this.preprocessEntityPaths();
        
        return true;
    }
    
    /**
     * Gets all entity IDs that have paths loaded
     * 
     * @returns Array of entity IDs
     */
    public getLoadedEntityIds(): string[] {
        return Array.from(this.entityPathsById.keys());
    }
    
    /**
     * Gets an entity's path by its ID
     * 
     * @param entityId The unique ID of the entity
     * @returns The entity's path, or undefined if not found
     */
    public getEntityPath(entityId: string): EntityPath | undefined {
        return this.entityPathsById.get(entityId);
    }
    
    /**
     * Gets entities active during a specific time range
     * 
     * @param startTime Start of the time range
     * @param endTime End of the time range
     * @returns Map of entity IDs to their paths
     */
    public getEntitiesInTimeRange(startTime: number, endTime: number): Map<string, EntityPath> {
        const result = new Map<string, EntityPath>();
        
        // Use the timeline index to find potential entities
        const BUCKET_SIZE = 10;
        const startBucket = Math.floor(startTime / BUCKET_SIZE);
        const endBucket = Math.floor(endTime / BUCKET_SIZE);
        
        // Collect all entity IDs from relevant buckets
        const potentialEntityIds = new Set<string>();
        
        for (let bucket = startBucket; bucket <= endBucket; bucket++) {
            const key = `bucket_${bucket}`;
            const bucketEntities = this.timelineIndex.get(key);
            
            if (bucketEntities) {
                for (const entityId of bucketEntities) {
                    potentialEntityIds.add(entityId);
                }
            }
        }
        
        // Filter to entities that are actually active in the time range
        for (const entityId of potentialEntityIds) {
            const entityPath = this.entityPathsById.get(entityId);
            if (!entityPath || entityPath.path.length === 0) continue;
            
            const firstPoint = entityPath.path[0];
            const lastPoint = entityPath.path[entityPath.path.length - 1];
            
            // Entity is active if its path overlaps with the time range
            if (firstPoint.clock <= endTime && lastPoint.clock >= startTime) {
                result.set(entityId, entityPath);
            }
        }
        
        return result;
    }
    
    /**
     * Gets entity IDs active at a specific time, using the timeline index for efficiency
     * 
     * @param time Simulation time
     * @returns Set of entity IDs active at that time
     */
    public getEntityIdsAtTime(time: number): Set<string> {
        // If we haven't built the timeline index yet, do so now
        if (this.timelineIndex.size === 0) {
            this.preprocessEntityPaths();
        }
        
        const BUCKET_SIZE = 10;
        const bucket = Math.floor(time / BUCKET_SIZE);
        const key = `bucket_${bucket}`;
        
        // Get all entities potentially active in this bucket
        const potentialEntityIds = this.timelineIndex.get(key) || new Set<string>();
        
        // Filter to only those actually active at the exact time
        const activeEntityIds = new Set<string>();
        
        for (const entityId of potentialEntityIds) {
            const entityPath = this.entityPathsById.get(entityId);
            if (!entityPath) continue;
            
            const firstPoint = entityPath.path[0];
            const lastPoint = entityPath.path[entityPath.path.length - 1];
            
            if (firstPoint.clock <= time && lastPoint.clock >= time) {
                activeEntityIds.add(entityId);
            }
        }
        
        return activeEntityIds;
    }
    
    /**
     * Gets an entity's state at a specific time
     * 
     * @param entityId The entity's ID
     * @param time The simulation time
     * @returns The entity's state and position, or undefined if not found or not active at that time
     */
    public getEntityStateAtTime(entityId: string, time: number): { state: string, x: number, y: number } | undefined {
        const entityPath = this.entityPathsById.get(entityId);
        if (!entityPath || entityPath.path.length === 0) {
            return undefined;
        }
        
        const path = entityPath.path;
        
        // Check if the entity exists at this time
        const firstPoint = path[0];
        const lastPoint = path[path.length - 1];
        
        if (time < firstPoint.clock || time > lastPoint.clock) {
            return undefined; // Entity doesn't exist at this time
        }
        
        // If the time exactly matches a point, return that point's data
        for (const point of path) {
            if (point.clock === time) {
                return {
                    state: point.state,
                    x: point.x,
                    y: point.y
                };
            }
        }
        
        // Otherwise, interpolate between the two closest points
        let beforePoint: PathPoint | undefined;
        let afterPoint: PathPoint | undefined;
        
        for (let i = 0; i < path.length - 1; i++) {
            if (path[i].clock <= time && path[i + 1].clock >= time) {
                beforePoint = path[i];
                afterPoint = path[i + 1];
                break;
            }
        }
        
        if (!beforePoint || !afterPoint) {
            return undefined; // Should not happen if we passed the earlier checks
        }
        
        // Calculate interpolated position
        const timeRatio = (time - beforePoint.clock) / (afterPoint.clock - beforePoint.clock);
        const x = beforePoint.x + timeRatio * (afterPoint.x - beforePoint.x);
        const y = beforePoint.y + timeRatio * (afterPoint.y - beforePoint.y);
        
        // Use the state from the 'before' point
        return {
            state: beforePoint.state,
            x,
            y
        };
    }
    
    /**
     * Gets all entities of a specific type
     * 
     * @param entityType The type of entity to find (e.g., "Customer", "Patient")
     * @returns Map of entity IDs to their paths
     */
    public getEntitiesByType(entityType: string): Map<string, EntityPath> {
        const result = new Map<string, EntityPath>();
        
        for (const [entityId, entityPath] of this.entityPathsById.entries()) {
            if (entityPath.type === entityType) {
                result.set(entityId, entityPath);
            }
        }
        
        return result;
    }
    
    /**
     * Loads any additional entity path batches needed for a specific time range
     * 
     * @param startTime Start of the time range
     * @param endTime End of the time range
     * @returns Promise resolving when all needed batches are loaded
     */
    public async loadEntityPathsForTimeRange(startTime: number, endTime: number): Promise<void> {
        const activeReplication = this.replicationManager.getActiveReplication();
        if (!activeReplication) {
            return;
        }
        
        // Find batch files that might contain entities active in this time range
        // A batch could contain relevant entities if:
        // - Entities enter during or before the time range (entryTimeStart <= endTime)
        // - The batch hasn't been loaded yet
        const batchesToLoad = activeReplication.entityPathDataFiles.filter(batch => 
            batch.entryTimeStart <= endTime && 
            !this.loadedEntityPathBatches.has(batch.filePath)
        );
        
        // Load each batch
        const loadPromises = batchesToLoad.map(batch => this.loadEntityPathBatch(batch));
        await Promise.all(loadPromises);
        
        console.log(`Loaded ${batchesToLoad.length} additional entity path batches for time range ${startTime}-${endTime}`);
    }
}
