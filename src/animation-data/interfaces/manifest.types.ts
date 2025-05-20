import { EntityPathDataFileInfo } from './entityPath.types';
import { StatisticsDataFileInfo } from './statistics.types';

/**
 * Metadata about a simulation replication
 */
export interface ReplicationManifestMetadata {
    /** Version of the manifest format */
    formatVersion: string;
    
    /** Identifier of the simulation */
    simulationId: string;
    
    /** Replication number */
    replication: number;
    
    /** Optional name of the replication */
    name?: string;
    
    /** Duration of the simulation in time units */
    duration: number;
    
    /** Time unit used in the simulation */
    timeUnit: string;
    
    /** Path to the model layout file */
    modelLayoutPath: string;
    
    /** Path to the shared visual configuration file */
    sharedVisualConfigPath: string;
    
    /** Path to the background SVG file */
    backgroundSvgPath: string;
}

// Import EntityPathDataFileInfo from entityPath.types to avoid duplication
export type { EntityPathDataFileInfo } from './entityPath.types';

/**
 * Complete manifest data for a replication
 */
export interface ReplicationManifestData {
    /** Metadata about this replication */
    metadata: ReplicationManifestMetadata;
    
    /** Information about entity path data files */
    entityPathDataFiles: EntityPathDataFileInfo[];
    
    /** Information about statistics data files */
    statisticsDataFiles: StatisticsDataFileInfo[];
}