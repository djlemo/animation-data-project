import { FileReader } from '../loaders/FileReader.interface';
import { 
    StatisticsDataFileInfo, 
    StatisticsData, 
    StatisticKey,
    StatisticsMap,
    TimeSeriesPoint
} from '../interfaces';
import { CacheManager } from './CacheManager';
import { ReplicationManager } from './ReplicationManager';

/**
 * Manages statistics data loading and querying
 */
export class StatisticsManager {
    /** File reader implementation */
    private reader: FileReader;
    
    /** Cache manager for JSON data */
    private cacheManager: CacheManager;
    
    /** Replication manager for accessing active replication data */
    private replicationManager: ReplicationManager;
    
    /** Map of loaded statistics data by their unique key */
    private statisticsData: StatisticsMap = new Map();
    
    /** Cache for loaded statistics files by path */
    private loadedStatisticsFiles: Map<string, StatisticsData> = new Map();
    
    /**
     * Creates a new StatisticsManager instance
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
     * Loads a statistics data file
     * 
     * @param fileInfo Information about the statistics file to load
     * @returns Promise resolving to the loaded statistics data, or undefined if loading failed
     */
    public async loadStatisticsFile(fileInfo: StatisticsDataFileInfo): Promise<StatisticsData | undefined> {
        // Check if already loaded
        if (this.loadedStatisticsFiles.has(fileInfo.filePath)) {
            return this.loadedStatisticsFiles.get(fileInfo.filePath);
        }
        
        // Load and parse the statistics file
        const statsData = await this.cacheManager.fetchAndParseJSON<StatisticsData>(fileInfo.filePath);
        
        if (!statsData) {
            console.error(`StatisticsManager: Failed to load statistics from ${fileInfo.filePath}`);
            return undefined;
        }
        
        // Store in our loaded files map
        this.loadedStatisticsFiles.set(fileInfo.filePath, statsData);
        
        // Add to our statistics data map with a unique key
        const key = this.getStatisticKey(
            statsData.type,
            statsData.componentId,
            statsData.metricName
        );
        
        this.statisticsData.set(key, statsData);
        
        return statsData;
    }
    
    /**
     * Loads multiple statistics files in parallel
     * 
     * @param fileInfos Information about the statistics files to load
     * @returns Promise resolving to a map of loaded statistics data
     */
    public async loadStatisticsFilesInParallel(fileInfos: StatisticsDataFileInfo[]): Promise<Map<string, StatisticsData>> {
        const loadPromises = fileInfos.map(fileInfo => this.loadStatisticsFile(fileInfo));
        const results = await Promise.all(loadPromises);
        
        const loadedStats = new Map<string, StatisticsData>();
        
        for (const statsData of results) {
            if (statsData) {
                const key = this.getStatisticKey(
                    statsData.type,
                    statsData.componentId,
                    statsData.metricName
                );
                
                loadedStats.set(key, statsData);
            }
        }
        
        return loadedStats;
    }
    
    /**
     * Generates a unique key for a statistic
     */
    private getStatisticKey(type: string, componentId: string, metricName: string): StatisticKey {
        return `${type}:${componentId}:${metricName}`;
    }
    
    /**
     * Clears all loaded statistics data
     */
    public clearStatisticsData(): void {
        this.statisticsData.clear();
        this.loadedStatisticsFiles.clear();
    }
    
    /**
     * Loads statistics data for the active replication
     * 
     * @returns Promise resolving to true if successful, false otherwise
     */
    public async loadStatisticsDataForActiveReplication(): Promise<boolean> {
        const activeReplication = this.replicationManager.getActiveReplication();
        if (!activeReplication) {
            return false;
        }
        
        // Clear any existing statistics data
        this.clearStatisticsData();
        
        // Check if there are any statistics data files to load
        if (!activeReplication.statisticsDataFiles || activeReplication.statisticsDataFiles.length === 0) {
            console.log(`No statistics data files found for replication ${this.replicationManager.getActiveReplicationId()}`);
            return true;
        }
        
        // Load all statistics files in parallel
        await this.loadStatisticsFilesInParallel(activeReplication.statisticsDataFiles);
        
        return true;
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
        const key = this.getStatisticKey(
            type,
            componentId,
            metricName
        );
        return this.statisticsData.get(key);
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
        const statistic = this.getStatistic(type, componentId, metricName);
        if (!statistic || statistic.timeSeries.length === 0) {
            return undefined;
        }
        
        const timeSeries = statistic.timeSeries;
        
        // Check if the time is before the first data point or after the last
        if (time < timeSeries[0].time) {
            return timeSeries[0].value; // Return the first value
        }
        
        if (time > timeSeries[timeSeries.length - 1].time) {
            return timeSeries[timeSeries.length - 1].value; // Return the last value
        }
        
        // Check if the time exactly matches a data point
        for (const point of timeSeries) {
            if (point.time === time) {
                return point.value;
            }
        }
        
        // If we need to interpolate, find the two closest points
        if (interpolate) {
            let beforePoint: TimeSeriesPoint | undefined;
            let afterPoint: TimeSeriesPoint | undefined;
            
            for (let i = 0; i < timeSeries.length - 1; i++) {
                if (timeSeries[i].time <= time && timeSeries[i + 1].time >= time) {
                    beforePoint = timeSeries[i];
                    afterPoint = timeSeries[i + 1];
                    break;
                }
            }
            
            if (beforePoint && afterPoint) {
                // Linear interpolation
                const timeRatio = (time - beforePoint.time) / (afterPoint.time - beforePoint.time);
                return beforePoint.value + timeRatio * (afterPoint.value - beforePoint.value);
            }
        }
        
        // If we get here and interpolation is off, find the closest point
        let closestPoint = timeSeries[0];
        let minDistance = Math.abs(time - closestPoint.time);
        
        for (let i = 1; i < timeSeries.length; i++) {
            const distance = Math.abs(time - timeSeries[i].time);
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = timeSeries[i];
            }
        }
        
        return closestPoint.value;
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
        const statistic = this.getStatistic(type, componentId, metricName);
        if (!statistic) {
            return [];
        }
        
        // Filter the time series to only include points within the range
        return statistic.timeSeries.filter(point => 
            point.time >= startTime && point.time <= endTime
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
        const statistic = this.getStatistic(type, componentId, metricName);
        if (!statistic || statistic.timeSeries.length === 0) {
            return undefined;
        }
        
        const values = statistic.timeSeries.map(point => point.value);
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        const sum = values.reduce((acc, val) => acc + val, 0);
        const mean = sum / values.length;
        
        return { min, max, mean };
    }
}
