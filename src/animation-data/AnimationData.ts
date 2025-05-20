import { FileReader } from './loaders/FileReader.interface';
import { 
    ReplicationManifestData, 
    ModelLayout, 
    SharedVisualConfig, 
    ReplicationManifestMetadata, 
    BasicEntityPath, 
    EntityPathBatch,
    EntityPathDataFileInfo,
    EntityPath,
    PathPoint,
    StatisticsDataFileInfo,
    StatisticsData,
    StatisticKey,
    StatisticsMap,
    TimeSeriesPoint
} from './interfaces';

/**
 * Main class for managing animation data
 */
export class AnimationData {
    /** File reader implementation */
    private reader: FileReader;
    
    /** Map of available replications by ID */
    public availableReplications: Map<number, ReplicationManifestData>;
    
    /** Model layout data (shared across replications) */
    public modelLayout?: ModelLayout;
    
    /** Visual configuration (shared across replications) */
    public sharedVisualConfig?: SharedVisualConfig;
    
    /** Currently active replication ID */
    private activeReplicationId?: number;
    
    /** Cache for loaded JSON files */
    private jsonCache: Map<string, any> = new Map();
    
    /** Map of loaded entity path batches by file path */
    private loadedEntityPathBatches: Map<string, EntityPathBatch>;
    
    /** Map of entity IDs to their paths (for quick lookup) */
    private entityPathsById: Map<string, EntityPath>;
    
    /** 
     * Timeline index for efficient lookup of entities by time
     * Maps time bucket keys to sets of entity IDs active during that time bucket
     */
    private timelineIndex: Map<string, Set<string>>;
    
    /** Map of loaded statistics data by their unique key */
    private statisticsData: StatisticsMap = new Map();
    
    /** Cache for loaded statistics files by path */
    private loadedStatisticsFiles: Map<string, StatisticsData> = new Map();

    /**
     * Creates a new AnimationData instance
     * 
     * @param reader File reader to use for loading data
     */
    constructor(reader: FileReader) {
        this.reader = reader;
        this.availableReplications = new Map();
        this.loadedEntityPathBatches = new Map();
        this.entityPathsById = new Map();
        this.timelineIndex = new Map();
        this.statisticsData = new Map();
        this.loadedStatisticsFiles = new Map();
    }
    
    /**
     * Fetches and parses a JSON file with caching
     * 
     * @param relativePath Path to the JSON file
     * @returns Parsed JSON object, or undefined if the file couldn't be read or parsed
     */
    private async fetchAndParseJSONWithCache<T>(relativePath: string): Promise<T | undefined> {
        // Check cache first
        if (this.jsonCache.has(relativePath)) {
            return this.jsonCache.get(relativePath) as T;
        }
        
        // Not in cache, load and parse
        const content = await this.reader.readFileAsText(relativePath);
        if (content) {
            try {
                const parsed = JSON.parse(content) as T;
                // Store in cache
                this.jsonCache.set(relativePath, parsed);
                return parsed;
            } catch (e) {
                console.error(`AnimationData: Error parsing JSON from path ${relativePath}:`, e);
                return undefined;
            }
        }
        return undefined;
    }
    
    // Keep the old method for backward compatibility, but make it use the cached version
    private async fetchAndParseJSON<T>(relativePath: string): Promise<T | undefined> {
        return this.fetchAndParseJSONWithCache<T>(relativePath);
    }
    
    /**
     * Initializes animation data by discovering available replications
     */
    public async initializeOrDiscoverReplications(): Promise<void> {
        console.log('AnimationData: Initializing and discovering replications...');
        const replicationDirItems = await this.reader.listDirectoryContents('replications');
        
        if (!replicationDirItems) {
            console.warn("AnimationData: Could not list 'replications' directory or it's empty.");
            return;
        }
        
        let firstManifestLoaded = false;
        
        for (const item of replicationDirItems) {
            if (item.isDirectory && item.name.startsWith('rep_')) {
                // Extract replication ID from directory name (e.g., "rep_001" → "001")
                const repIdStr = item.name.substring(4);
                
                // Construct path to the manifest file
                const manifestFileName = `animation_manifest_rep_${repIdStr}.json`;
                const manifestRelativePath = ['replications', item.name, manifestFileName].join('/');
                
                // Load and parse the manifest
                const manifestData = await this.fetchAndParseJSONWithCache<ReplicationManifestData>(manifestRelativePath);
                
                if (manifestData) {
                    // Store the manifest in our map, using replication ID as the key
                    this.availableReplications.set(manifestData.metadata.replication, manifestData);
                    console.log(`Loaded manifest for replication ${manifestData.metadata.replication}`);
                    
                    // For the first valid manifest, also load shared files
                    if (!firstManifestLoaded) {
                        if (manifestData.metadata.modelLayoutPath) {
                            this.modelLayout = await this.fetchAndParseJSONWithCache<ModelLayout>(
                                manifestData.metadata.modelLayoutPath
                            );
                            
                            if (this.modelLayout) {
                                console.log("Model layout loaded.");
                            } else {
                                console.warn("Failed to load model layout.");
                            }
                        }
                        
                        if (manifestData.metadata.sharedVisualConfigPath) {
                            this.sharedVisualConfig = await this.fetchAndParseJSONWithCache<SharedVisualConfig>(
                                manifestData.metadata.sharedVisualConfigPath
                            );
                            
                            if (this.sharedVisualConfig) {
                                console.log("Shared visual config loaded.");
                            } else {
                                console.warn("Failed to load shared visual config.");
                            }
                        }
                        
                        firstManifestLoaded = true;
                    }
                } else {
                    console.warn(`AnimationData: Failed to load manifest: ${manifestRelativePath}`);
                }
            }
        }
        
        console.log(`AnimationData: Discovery complete. Found ${this.availableReplications.size} replications.`);
    }
    
    /**
     * Loads an entity path batch file
     * 
     * @param fileInfo Information about the entity path file to load
     * @returns Promise resolving to the loaded batch, or undefined if loading failed
     */
    private async loadEntityPathBatch(fileInfo: EntityPathDataFileInfo): Promise<EntityPathBatch | undefined> {
        // Check if we've already loaded this batch
        if (this.loadedEntityPathBatches.has(fileInfo.filePath)) {
            return this.loadedEntityPathBatches.get(fileInfo.filePath);
        }
        
        // Load and parse the batch file
        const batch = await this.fetchAndParseJSON<EntityPathBatch>(fileInfo.filePath);
        
        if (batch) {
            console.log(`Loaded entity path batch from ${fileInfo.filePath} with ${Object.keys(batch).length} entities`);
            
            // Store the batch
            this.loadedEntityPathBatches.set(fileInfo.filePath, batch);
            
            // Add individual entity paths to our lookup map
            for (const [entityId, entityPath] of Object.entries(batch)) {
                this.entityPathsById.set(entityId, entityPath);
            }
            
            // Rebuild the timeline index with the new data
            this.preprocessEntityPaths();
            
            return batch;
        } else {
            console.error(`Failed to load entity path batch from ${fileInfo.filePath}`);
            return undefined;
        }
    }

    /**
     * Pre-processes entity paths for faster access
     * This builds indexes and data structures to optimize lookups
     */
    private preprocessEntityPaths(): void {
        console.log('Building timeline index for entity paths...');
        
        // Reset the timeline index
        this.timelineIndex = new Map<string, Set<string>>();
        
        // Divide simulation time into buckets (e.g., 10 time units per bucket)
        const BUCKET_SIZE = 10;
        
        for (const [entityId, entityPath] of this.entityPathsById.entries()) {
            if (entityPath.path.length === 0) continue;
            
            const firstTime = entityPath.path[0].clock;
            const lastTime = entityPath.path[entityPath.path.length - 1].clock;
            
            // Determine which buckets this entity belongs in
            const startBucket = Math.floor(firstTime / BUCKET_SIZE);
            const endBucket = Math.floor(lastTime / BUCKET_SIZE);
            
            // Add entity to each relevant bucket
            for (let bucket = startBucket; bucket <= endBucket; bucket++) {
                const key = `bucket_${bucket}`;
                if (!this.timelineIndex.has(key)) {
                    this.timelineIndex.set(key, new Set<string>());
                }
                this.timelineIndex.get(key)!.add(entityId);
            }
        }
        
        console.log(`Built timeline index with ${this.timelineIndex.size} buckets`);
    }

    /**
     * Loads a statistics data file
     * 
     * @param fileInfo Information about the statistics file to load
     * @returns Promise resolving to the loaded statistics data, or undefined if loading failed
     */
    private async loadStatisticsFile(fileInfo: StatisticsDataFileInfo): Promise<StatisticsData | undefined> {
        // Check if we've already loaded this file
        if (this.loadedStatisticsFiles.has(fileInfo.filePath)) {
            return this.loadedStatisticsFiles.get(fileInfo.filePath);
        }
        
        // Load and parse the statistics file
        const statsData = await this.fetchAndParseJSON<StatisticsData>(fileInfo.filePath);
        
        if (statsData) {
            console.log(`Loaded statistics from ${fileInfo.filePath}`);
            
            // Store the loaded data
            this.loadedStatisticsFiles.set(fileInfo.filePath, statsData);
            
            // Add to our statistics index
            const key = this.getStatisticKey(
                statsData.metadata.type, 
                statsData.metadata.componentId || '', 
                statsData.metadata.metricName
            );
            this.statisticsData.set(key, statsData);
            
            return statsData;
        } else {
            console.error(`Failed to load statistics from ${fileInfo.filePath}`);
            return undefined;
        }
    }
    
    /**
     * Generates a unique key for a statistic
     */
    private getStatisticKey(type: string, componentId: string, metricName: string): StatisticKey {
        return `${type}:${componentId}:${metricName}` as const;
    }
    
    /**
     * Gets all available statistics
     * 
     * @returns Array of statistic keys
     */
    public getAvailableStatistics(): StatisticKey[] {
        return Array.from(this.statisticsData.keys());
    }
    
    /**
     * Gets a specific statistic by type, component ID, and metric name
     * 
     * @param type The type of statistic (e.g., "activity_metric")
     * @param componentId The ID of the component
     * @param metricName The name of the metric
     * @returns The statistics data, or undefined if not found
     */
    public getStatistic(type: string, componentId: string, metricName: string): StatisticsData | undefined {
        const key = this.getStatisticKey(type, componentId, metricName);
        return this.statisticsData.get(key);
    }
    
    /**
     * Gets the value of a statistic at a specific time, with optional interpolation
     * 
     * @param type The type of statistic
     * @param componentId The ID of the component
     * @param metricName The name of the metric
     * @param time The time to get the value at
     * @param interpolate Whether to interpolate between time points (default: true)
     * @returns The value at the specified time, or undefined if not found
     */
    public getStatisticValueAtTime(
        type: string, 
        componentId: string, 
        metricName: string, 
        time: number,
        interpolate: boolean = true
    ): number | undefined {
        const stats = this.getStatistic(type, componentId, metricName);
        if (!stats || !stats.timeSeries || stats.timeSeries.length === 0) {
            return undefined;
        }
        
        const { timeSeries } = stats;
        
        // Check if time is before first point
        if (time <= timeSeries[0].time) {
            return timeSeries[0].value;
        }
        
        // Check if time is after last point
        if (time >= timeSeries[timeSeries.length - 1].time) {
            return timeSeries[timeSeries.length - 1].value;
        }
        
        // Find the two points that bracket the time
        for (let i = 0; i < timeSeries.length - 1; i++) {
            const current = timeSeries[i];
            const next = timeSeries[i + 1];
            
            if (current.time <= time && next.time >= time) {
                if (!interpolate || current.time === next.time) {
                    return current.value;
                }
                
                // Linear interpolation
                const ratio = (time - current.time) / (next.time - current.time);
                return current.value + ratio * (next.value - current.value);
            }
        }
        
        return undefined;
    }
    
    /**
     * Gets a range of time series data for a specific time window
     * 
     * @param type The type of statistic
     * @param componentId The ID of the component
     * @param metricName The name of the metric
     * @param startTime Start of the time window
     * @param endTime End of the time window
     * @returns Array of time series points within the window
     */
    public getStatisticTimeSeriesForRange(
        type: string, 
        componentId: string, 
        metricName: string,
        startTime: number,
        endTime: number
    ): TimeSeriesPoint[] {
        const stats = this.getStatistic(type, componentId, metricName);
        if (!stats || !stats.timeSeries) {
            return [];
        }
        
        return stats.timeSeries.filter(
            point => point.time >= startTime && point.time <= endTime
        );
    }
    
    /**
     * Gets the summary statistics for a specific metric
     * 
     * @param type The type of statistic
     * @param componentId The ID of the component
     * @param metricName The name of the metric
     * @returns The summary statistics, or undefined if not found
     */
    public getStatisticSummary(
        type: string, 
        componentId: string, 
        metricName: string
    ) {
        return this.getStatistic(type, componentId, metricName)?.summary;
    }

    /**
     * Sets the active replication and loads its data files
     * 
     * @param replicationId ID of the replication to activate
     * @returns Promise resolving to true if successful, false if replication not found
     */
    public async setActiveReplication(replicationId: number): Promise<boolean> {
        if (!this.availableReplications.has(replicationId)) {
            console.error(`AnimationData: Replication ID ${replicationId} not found.`);
            return false;
        }
        
        // Clear previously loaded data
        this.loadedEntityPathBatches.clear();
        this.entityPathsById.clear();
        this.timelineIndex.clear();
        this.loadedStatisticsFiles.clear();
        this.statisticsData.clear();
        
        this.activeReplicationId = replicationId;
        console.log(`AnimationData: Set active replication to ID ${replicationId}`);
        
        // Get the replication data
        const replication = this.availableReplications.get(replicationId)!;
        
        // Load entity path files (starting with early time windows first)
        const sortedPathFiles = [...(replication.entityPathDataFiles || [])]
            .sort((a, b) => a.entryTimeStart - b.entryTimeStart);
        
        // Load initial batches (you might want to implement lazy loading later)
        const initialBatchesToLoad = Math.min(2, sortedPathFiles.length);
        const loadPromises: Promise<any>[] = [];
        
        for (let i = 0; i < initialBatchesToLoad; i++) {
            loadPromises.push(this.loadEntityPathBatch(sortedPathFiles[i]));
        }
        
        // Load all statistics files for this replication
        if (replication.statisticsDataFiles) {
            for (const statsFile of replication.statisticsDataFiles) {
                loadPromises.push(this.loadStatisticsFile(statsFile));
            }
        }
        
        // Wait for all initial loads to complete
        await Promise.all(loadPromises);
        
        return true;
    }

    /**
     * Gets the currently active replication ID
     * 
     * @returns The active replication ID, or undefined if none is active
     */
    public getActiveReplicationId(): number | undefined {
        return this.activeReplicationId;
    }
    
    /**
     * Gets metadata for the active replication
     * 
     * @returns Metadata for the active replication, or undefined if none is active
     */
    public getActiveReplicationMetadata(): ReplicationManifestMetadata | undefined {
        if (this.activeReplicationId === undefined) {
            return undefined;
        }
        
        const replication = this.availableReplications.get(this.activeReplicationId);
        return replication?.metadata;
    }
    
    /**
     * Gets entity paths in a time range for the active replication
     * 
     * @param startTime Start time of the range
     * @param endTime End time of the range
     * @param replicationId ID of the replication
     * @returns Promise resolving to an array of entity paths, or undefined if no active replication
     */
    public async getEntityPathsInTimeRange(
        startTime: number, 
        endTime: number,
        replicationId: string
    ): Promise<BasicEntityPath[] | undefined> {
        if (this.activeReplicationId === undefined) {
            return undefined;
        }
        
        const replication = this.availableReplications.get(this.activeReplicationId);
        if (!replication) {
            return undefined;
        }
        
        // Find relevant entity path files
        const relevantFiles = replication.entityPathDataFiles.filter(
            file => file.entryTimeStart <= endTime && file.entryTimeEnd >= startTime
        );
        
        // Load and parse each file
        const allPaths: BasicEntityPath[] = [];
        for (const file of relevantFiles) {
            const pathData = await this.loadEntityPathBatch(file);
            if (pathData && pathData.paths) {
                allPaths.push(...pathData.paths);
            }
        }
        
        return allPaths;
    }
    
    /**
     * Clears the JSON cache
     * 
     * @param path Optional path to clear a specific entry, or clear all if not provided
     */
    public clearCache(path?: string): void {
        if (path) {
            this.jsonCache.delete(path);
        } else {
            this.jsonCache.clear();
        }
    }
    
    /**
     * Gets the current cache size
     * 
     * @returns Number of items in the cache
     */
    public getCacheSize(): number {
        return this.jsonCache.size;
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
     * Gets all entity IDs that have paths loaded
     * 
     * @returns Array of entity IDs
     */
    public getLoadedEntityIds(): string[] {
        return Array.from(this.entityPathsById.keys());
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
        
        // Check each entity
        for (const [entityId, entityPath] of this.entityPathsById.entries()) {
            // An entity is active in this time range if it has at least one path point within the range
            const firstPoint = entityPath.path[0];
            const lastPoint = entityPath.path[entityPath.path.length - 1];
            
            // Check if entity's lifetime overlaps with the time range
            if (firstPoint.clock <= endTime && lastPoint.clock >= startTime) {
                result.set(entityId, entityPath);
            }
        }
        
        return result;
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
        if (!entityPath) {
            return undefined;
        }
        
        // Find the path points that bracket the specified time
        const path = entityPath.path;
        
        // If time is before first point or after last point, entity is not active
        if (time < path[0].clock || time > path[path.length - 1].clock) {
            return undefined;
        }
        
        // Special case: exact match to a path point
        const exactMatch = path.find(point => point.clock === time);
        if (exactMatch) {
            return {
                state: exactMatch.state,
                x: exactMatch.x,
                y: exactMatch.y
            };
        }
        
        // Find the two points that bracket the time
        let beforePoint: PathPoint | undefined;
        let afterPoint: PathPoint | undefined;
        
        for (let i = 0; i < path.length - 1; i++) {
            if (path[i].clock <= time && path[i + 1].clock > time) {
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
     * Loads any additional entity path batches needed for a specific time range
     * 
     * @param startTime Start of the time range
     * @param endTime End of the time range
     * @returns Promise resolving when all needed batches are loaded
     */
    public async loadEntityPathsForTimeRange(startTime: number, endTime: number): Promise<void> {
        if (this.activeReplicationId === undefined) {
            return;
        }
        
        const replication = this.availableReplications.get(this.activeReplicationId)!;
        
        // Find batch files that might contain entities active in this time range
        // A batch could contain relevant entities if:
        // - Entities enter during or before the time range (entryTimeStart <= endTime)
        // - The batch hasn't been loaded yet
        const batchesToLoad = replication.entityPathDataFiles.filter(batch => 
            batch.entryTimeStart <= endTime && 
            !this.loadedEntityPathBatches.has(batch.filePath)
        );
        
        // Load each batch
        const loadPromises = batchesToLoad.map(batch => this.loadEntityPathBatch(batch));
        await Promise.all(loadPromises);
        
        console.log(`Loaded ${batchesToLoad.length} additional entity path batches for time range ${startTime}-${endTime}`);
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
}