/**
 * Represents the shared visual configuration
 */
export interface SharedVisualConfig {
    backgroundMode: any;
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
}