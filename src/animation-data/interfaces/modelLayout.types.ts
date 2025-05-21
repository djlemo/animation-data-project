/**
 * Represents the model layout file content
 */
export interface ModelLayout {
    /** Version of the format */
    formatVersion: string;
    
    /** Identifier of the simulation */
    simulationId: string;
    
    /** Visual configuration properties */
    visualization: {
        /** Background display mode */
        backgroundMode: string;
        
        // We'll add more properties later
    };
    
    /** Background display mode at root level */
    backgroundMode: string;
    
    // We'll add more properties later
}