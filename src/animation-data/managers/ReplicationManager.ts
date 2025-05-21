import { FileReader } from '../loaders/FileReader.interface';
import { 
    ReplicationManifestData, 
    ModelLayout, 
    SharedVisualConfig, 
    ReplicationManifestMetadata 
} from '../interfaces';
import { CacheManager } from './CacheManager';

/**
 * Manages replication discovery, loading, and activation
 */
export class ReplicationManager {
    /** File reader implementation */
    private reader: FileReader;
    
    /** Cache manager for JSON data */
    private cacheManager: CacheManager;
    
    /** Map of available replications by ID */
    public availableReplications: Map<number, ReplicationManifestData> = new Map();
    
    /** Model layout data (shared across replications) */
    public modelLayout?: ModelLayout;
    
    /** Visual configuration (shared across replications) */
    public sharedVisualConfig?: SharedVisualConfig;
    
    /** Currently active replication ID */
    private activeReplicationId?: number;
    
    /**
     * Creates a new ReplicationManager instance
     * 
     * @param reader File reader to use for loading data
     * @param cacheManager Cache manager for JSON data
     */
    constructor(reader: FileReader, cacheManager: CacheManager) {
        this.reader = reader;
        this.cacheManager = cacheManager;
    }
    
    /**
     * Initializes animation data by discovering available replications
     */
    public async discoverReplications(): Promise<void> {
        console.log('AnimationData: Initializing and discovering replications...');
        const replicationDirItems = await this.reader.listDirectoryContents('replications');
        
        if (!replicationDirItems) {
            console.error('AnimationData: Failed to list replication directories');
            return;
        }
        
        // Use relative paths since the root path is already set in NodeFileReader
        const modelLayoutPath = 'model_layout.json';
        const visualConfigPath = 'shared_visual_config.json';
        
        // Load shared model layout
        try {
            this.modelLayout = await this.reader.readJSONFile<ModelLayout>(modelLayoutPath);
            const fullPath = this.reader.resolveFullPath(modelLayoutPath);
            console.log(`Model layout loaded successfully from: ${fullPath}`);
        } catch (error) {
            const fullPath = this.reader.resolveFullPath(modelLayoutPath);
            console.warn(`AnimationData: Model layout file not found or invalid at ${fullPath}. Continuing without model layout.`);
        }
        
        // Load shared visual configuration
        try {
            this.sharedVisualConfig = await this.reader.readJSONFile<SharedVisualConfig>(visualConfigPath);
            const fullPath = this.reader.resolveFullPath(visualConfigPath);
            console.log(`Visual configuration loaded successfully from: ${fullPath}`);
        } catch (error) {
            const fullPath = this.reader.resolveFullPath(visualConfigPath);
            console.warn(`AnimationData: Visual configuration file not found or invalid at ${fullPath}. Continuing without visual configuration.`);
        }
        
        // Process each replication directory
        for (const dirItem of replicationDirItems) {
            if (!dirItem.isDirectory) continue;
            
            // Extract replication ID from directory name
            // Expected format: "rep_XXX" where XXX is the replication ID number
            const dirName = dirItem.name;
            const repIdMatch = dirName.match(/rep_0*(\d+)/i);
            
            if (!repIdMatch) {
                console.warn(`AnimationData: Skipping directory with invalid name format: ${dirName}`);
                continue;
            }
            
            const repId = parseInt(repIdMatch[1], 10);
            console.log(`Extracted replication ID ${repId} from directory name`);
            
            // Load the manifest file for this replication
            const manifestPath = `replications/${dirName}/animation_manifest_${dirName}.json`;
            const manifestData = await this.cacheManager.fetchAndParseJSON<ReplicationManifestData>(manifestPath);
            
            if (!manifestData) {
                console.warn(`AnimationData: Failed to load manifest for replication ${repId}`);
                continue;
            }
            
            // Add entity path data file information
            manifestData.entityPathDataFiles = [{
                filePath: `replications/${dirName}/entity_paths/batch_001_rep001.json`,
                entryTimeStart: 0,
                entryTimeEnd: manifestData.metadata.duration
            }];
            
            console.log(`Loaded manifest for replication ${repId} with ${manifestData.entityPathDataFiles.length} entity path files`);
            
            // Store the replication data
            this.availableReplications.set(repId, manifestData);
        }
        
        console.log(`AnimationData: Discovery complete. Found ${this.availableReplications.size} replications.`);
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
     * Sets the active replication
     * 
     * @param replicationId ID of the replication to activate
     * @returns True if successful, false if replication not found
     */
    public setActiveReplicationId(replicationId: number): boolean {
        if (!this.availableReplications.has(replicationId)) {
            return false;
        }
        
        this.activeReplicationId = replicationId;
        console.log(`AnimationData: Set active replication to ID ${replicationId}`);
        return true;
    }
    
    /**
     * Gets the active replication data
     * 
     * @returns The active replication data, or undefined if none is active
     */
    public getActiveReplication(): ReplicationManifestData | undefined {
        if (this.activeReplicationId === undefined) {
            return undefined;
        }
        
        return this.availableReplications.get(this.activeReplicationId);
    }
}
