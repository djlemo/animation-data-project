/**
 * Information about a statistics data file, as referenced in the manifest
 */
export interface StatisticsDataFileInfo {
    /** Type of statistic (e.g., "activity_metric", "resource_metric") */
    type: string;
    
    /** ID of the component this statistic is for (for component-specific metrics) */
    componentId?: string;
    
    /** Name of the metric (e.g., "queueLength", "utilization") */
    metricName: string;
    
    /** Path to the statistics file */
    filePath: string;
    
    /** Start time of the data in the file */
    timeStart: number;
    
    /** End time of the data in the file */
    timeEnd: number;
}

/**
 * Statistics metadata
 */
export interface StatisticsMetadata {
    /** Type of statistic */
    type: string;
    
    /** ID of the component this statistic is for */
    componentId?: string;
    
    /** Name of the metric */
    metricName: string;
    
    /** Simulation ID */
    simulationId: string;
    
    /** Replication number */
    replication: number;
    
    /** Start time of the data */
    timeStart: number;
    
    /** End time of the data */
    timeEnd: number;
    
    /** Time unit used in the simulation */
    timeUnit: string;
}

/**
 * A single data point in a time series
 */
export interface TimeSeriesPoint {
    /** The time of this data point */
    time: number;
    
    /** The value at this time */
    value: number;
}

/**
 * Statistical summary of a time series
 */
export interface StatisticsSummary {
    /** Minimum value in the time series */
    min: number;
    
    /** Maximum value in the time series */
    max: number;
    
    /** Mean (average) value */
    mean: number;
    
    /** Median value */
    median: number;
    
    /** Standard deviation */
    stdDev: number;
    
    /** Number of data points */
    count: number;
}

/**
 * Complete statistics data for a single metric
 */
export interface StatisticsData {
    /** Metadata about this statistic */
    metadata: StatisticsMetadata;
    
    /** Statistical summary */
    summary: StatisticsSummary;
    
    /** Time series data points, sorted by time */
    timeSeries: TimeSeriesPoint[];
}

/**
 * A key that uniquely identifies a statistic
 */
export type StatisticKey = `${string}:${string}:${string}`;  // type:componentId:metricName

/**
 * A map of statistic keys to their data
 */
export type StatisticsMap = Map<StatisticKey, StatisticsData>;
