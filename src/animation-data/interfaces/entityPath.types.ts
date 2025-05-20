/**
 * Represents a single point in an entity's path
 */
export interface PathPoint {
    /** Simulation time at which this point in the path occurs */
    clock: number;
    
    /** X-coordinate position of the entity */
    x: number;
    
    /** Y-coordinate position of the entity */
    y: number;
    
    /** Event code representing the simulation event (e.g., "EMA", "ASP", "AEP") */
    event?: string;
    
    /** The entity's logical/visual state (e.g., "traveling", "waiting", "processing") */
    state: string;
    
    /** ID of the model component (Activity, Resource, Generator, Connector) */
    componentId?: string;
    
    /** Optional key-value map of entity attributes at this point in time */
    attributes?: Record<string, string | number | boolean>;
}

/**
 * Represents an entity's complete path through the simulation
 */
export interface EntityPath {
    /** Type of the entity (e.g., "Customer", "Patient") */
    type: string;
    
    /** Array of path points in chronological order */
    path: PathPoint[];
}

/**
 * Structure of an entity path batch file
 * Maps entity IDs to their paths
 */
export interface EntityPathBatch {
    /** Map of entity IDs to their path data */
    [entityId: string]: EntityPath;
}

/**
 * Information about an entity path data file
 * This matches the structure in the animation manifest
 */
export interface EntityPathDataFileInfo {
    /** Path to the file */
    filePath: string;
    
    /** Start time of entities in this file */
    entryTimeStart: number;
    
    /** End time of entities in this file */
    entryTimeEnd: number;
    
    /** Optional count of entities in this file */
    entityCount?: number;
}