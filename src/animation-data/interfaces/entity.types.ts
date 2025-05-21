/**
 * Represents a single point in an entity's path
 */
export interface PathPoint {
    /** X coordinate */
    x: number;
    
    /** Y coordinate */
    y: number;
    
    /** Timestamp for this point */
    t: number;
}

/**
 * Represents the basic path of an entity over time
 */
export interface BasicEntityPath {
    /** Unique identifier for the entity */
    id: string;
    
    /** Type or category of the entity */
    type: string;
    
    /** Array of points that make up the path */
    points: PathPoint[];
}

/**
 * Represents a batch of entity paths loaded from a file
 */
export interface EntityPathBatch {
    entities: any;
    entityPaths: any;
    /** Array of entity paths */
    paths: BasicEntityPath[];
    
    /** Start time of the batch */
    startTime: number;
    
    /** End time of the batch */
    endTime: number;
}
