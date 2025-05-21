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

import { CacheManager } from './managers/CacheManager';
import { ReplicationManager } from './managers/ReplicationManager';
import { EntityPathManager } from './managers/EntityPathManager';
import { StatisticsManager } from './managers/StatisticsManager';

/**
 * Main class for managing animation data
 * This class coordinates the various specialized managers
 */
export class AnimationData {
    /** File reader implementation */
    private reader: FileReader;
    
    /** Cache manager for JSON data */
    private cacheManager: CacheManager;
    
    /** Replication manager for handling replication discovery and management */
    private replicationManager: ReplicationManager;
    
    /** Entity path manager for handling entity path data */
    private entityPathManager: EntityPathManager;
    
    /** Statistics manager for handling statistics data */
    private statisticsManager: StatisticsManager;
    
    /**
     * Creates a new AnimationData instance
     * 
     * @param reader File reader to use for loading data
     */
    constructor(reader: FileReader) {
        this.reader = reader;
        
        // Initialize managers
        this.cacheManager = new CacheManager(reader);
        this.replicationManager = new ReplicationManager(reader, this.cacheManager);
        this.entityPathManager = new EntityPathManager(reader, this.cacheManager, this.replicationManager);
        this.statisticsManager = new StatisticsManager(reader, this.cacheManager, this.replicationManager);
    }
    
    /**
     * Initializes animation data by discovering available replications
     */
    public async initializeOrDiscoverReplications(): Promise<void> {
        await this.replicationManager.discoverReplications();
    }
    
    /**
     * Sets the active replication and loads its data files
     * 
     * @param replicationId ID of the replication to activate
     * @returns Promise resolving to true if successful, false if replication not found
     */
    public async setActiveReplication(replicationId: number): Promise<boolean> {
        // Set the active replication in the replication manager
        const success = this.replicationManager.setActiveReplicationId(replicationId);
        if (!success) {
            return false;
        }
        
        // Load entity path data for the active replication
        await this.entityPathManager.loadEntityPathDataForActiveReplication();
        
        // Load statistics data for the active replication
        await this.statisticsManager.loadStatisticsDataForActiveReplication();
        
        return true;
    }
    
    /**
     * Gets the currently active replication ID
     * 
     * @returns The active replication ID, or undefined if none is active
     */
    public getActiveReplicationId(): number | undefined {
        return this.replicationManager.getActiveReplicationId();
    }
    
    /**
     * Gets metadata for the active replication
     * 
     * @returns Metadata for the active replication, or undefined if none is active
     */
    public getActiveReplicationMetadata(): ReplicationManifestMetadata | undefined {
        return this.replicationManager.getActiveReplicationMetadata();
    }
    
    /**
     * Gets all entity IDs that have paths loaded
     * 
     * @returns Array of entity IDs
     */
    public getLoadedEntityIds(): string[] {
        return this.entityPathManager.getLoadedEntityIds();
    }
    
    /**
     * Gets entities active during a specific time range
     * 
     * @param startTime Start of the time range
     * @param endTime End of the time range
     * @returns Map of entity IDs to their paths
     */
    public getEntitiesInTimeRange(startTime: number, endTime: number): Map<string, EntityPath> {
        return this.entityPathManager.getEntitiesInTimeRange(startTime, endTime);
    }
    
    /**
     * Gets entity IDs active at a specific time
     * 
     * @param time Simulation time
     * @returns Set of entity IDs active at that time
     */
    public getEntityIdsAtTime(time: number): Set<string> {
        return this.entityPathManager.getEntityIdsAtTime(time);
    }
    
    /**
     * Gets an entity's state at a specific time
     * 
     * @param entityId The entity's ID
     * @param time The simulation time
     * @returns The entity's state and position, or undefined if not found or not active at that time
     */
    public getEntityStateAtTime(entityId: string, time: number): { state: string, x: number, y: number } | undefined {
        return this.entityPathManager.getEntityStateAtTime(entityId, time);
    }
    
    /**
     * Gets all entities of a specific type
     * 
     * @param entityType The type of entity to find (e.g., "Customer", "Patient")
     * @returns Map of entity IDs to their paths
     */
    public getEntitiesByType(entityType: string): Map<string, EntityPath> {
        return this.entityPathManager.getEntitiesByType(entityType);
    }
    
    /**
     * Loads any additional entity path batches needed for a specific time range
     * 
     * @param startTime Start of the time range
     * @param endTime End of the time range
     * @returns Promise resolving when all needed batches are loaded
     */
    public async loadEntityPathsForTimeRange(startTime: number, endTime: number): Promise<void> {
        await this.entityPathManager.loadEntityPathsForTimeRange(startTime, endTime);
    }
    
    /**
     * Gets all available statistics
     * 
     * @returns Array of statistic keys
     */
    public getAvailableStatistics(): StatisticKey[] {
        return this.statisticsManager.getAvailableStatistics();
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
        return this.statisticsManager.getStatistic(type, componentId, metricName);
    }
    
    /**
     * Gets the value of a statistic at a specific time, with optional interpolation
     * 
     * @param type The type of statistic
     * @param componentId The ID of the component
     * @param metricName The name of the metric
     * @param time The simulation time
     * @param interpolate Whether to interpolate between data points (default: true)
     * @returns The statistic value, or undefined if not found
     */
    public getStatisticValueAtTime(
        type: string, 
        componentId: string, 
        metricName: string, 
        time: number,
        interpolate: boolean = true
    ): number | undefined {
        return this.statisticsManager.getStatisticValueAtTime(type, componentId, metricName, time, interpolate);
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
        return this.statisticsManager.getStatisticTimeSeriesForRange(
            type, componentId, metricName, startTime, endTime
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
    ): { min: number, max: number, mean: number } | undefined {
        return this.statisticsManager.getStatisticSummary(type, componentId, metricName);
    }
    
    /**
     * Clears the JSON cache
     * 
     * @param path Optional path to clear a specific entry, or clear all if not provided
     */
    public clearCache(path?: string): void {
        this.cacheManager.clearCache(path);
    }
    
    /**
     * Gets the current cache size
     * 
     * @returns Number of items in the cache
     */
    public getCacheSize(): number {
        return this.cacheManager.getCacheSize();
    }
    
    /**
     * Provides access to the model layout data
     */
    public get modelLayout(): ModelLayout | undefined {
        return this.replicationManager.modelLayout;
    }
    
    /**
     * Provides access to the shared visual configuration
     */
    public get sharedVisualConfig(): SharedVisualConfig | undefined {
        return this.replicationManager.sharedVisualConfig;
    }
    
    /**
     * Provides access to the available replications
     */
    public get availableReplications(): Map<number, ReplicationManifestData> {
        return this.replicationManager.availableReplications;
    }
}