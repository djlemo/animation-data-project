import { AnimationData } from './animation-data/AnimationData';
import { NodeFileReader } from './animation-data/loaders/NodeFileReader';
import * as path from 'path';

/**
 * Tests the AnimationData class with local files
 */
async function runStandaloneTest() {
    console.log('--- Starting AnimationData Standalone Test ---');
    
    // Path to our test data directory
    // __dirname is the directory containing the current file
    const studyPath = path.resolve(__dirname, '..', 'sample_study_data', 'my_simple_study');
    console.log(`Targeting study path: ${studyPath}`);
    
    try {
        // Create a file reader pointing to our test data
        const nodeReader = new NodeFileReader(studyPath);
        
        // Create an AnimationData instance using the reader
        const animData = new AnimationData(nodeReader);
        
        // Initialize and discover available replications
        await animData.initializeOrDiscoverReplications();
        
        // Display information about available replications
        console.log(`\nAvailable Replications (${animData.availableReplications.size}):`);
        animData.availableReplications.forEach((manifest, repId) => {
            console.log(`  ID: ${repId}, Name: ${manifest.metadata.name}`);
        });
        
        // Check if we have a model layout
        if (animData.modelLayout) {
            console.log(`\nModel Layout Loaded: Simulation ID "${animData.modelLayout.simulationId}"`);
        } else {
            console.error('\nModel Layout FAILED to load.');
        }
        
        // Check if we have a visual configuration
        if (animData.sharedVisualConfig) {
            console.log(`Shared Visual Config Loaded: Background mode "${animData.sharedVisualConfig.visualization.backgroundMode}"`);
        } else {
            console.error('\nShared Visual Config FAILED to load.');
        }
        
        // If we found at least one replication, test activating it
        if (animData.availableReplications.size > 0) {
            const firstRepId = Array.from(animData.availableReplications.keys())[0];
            await animData.setActiveReplication(firstRepId);
            
            const metadata = animData.getActiveReplicationMetadata();
            console.log(`\nActive Replication Metadata: ${JSON.stringify(metadata, null, 2)}`);
        }
        
    } catch (err) {
        console.error("\n--- Test Failed ---");
        console.error(err);
    }
    
    console.log('\n--- Test Complete ---');
}

async function runEntityPathTest() {
    console.log('=== AnimationData Entity Path Test ===');
    
    const studyPath = path.resolve(__dirname, '..', 'sample_study_data', 'my_simple_study');
    console.log(`Target study path: ${studyPath}`);
    
    try {
        // Create instances
        const nodeReader = new NodeFileReader(studyPath);
        const animData = new AnimationData(nodeReader);
        
        // Initialize and discover replications
        await animData.initializeOrDiscoverReplications();
        
        if (animData.availableReplications.size === 0) {
            console.error('No replications found');
            return;
        }
        
        // Set the first replication as active (this will load entity path files)
        const firstRepId = Array.from(animData.availableReplications.keys())[0];
        await animData.setActiveReplication(firstRepId);
        
        // Test entity path access methods
        console.log('\n--- Entity Path Tests ---');
        
        // Get all loaded entity IDs
        const entityIds = animData.getLoadedEntityIds();
        console.log(`Loaded entity IDs: ${entityIds.join(', ')}`);
        
        // Get entities in a time range
        const entitiesInRange = animData.getEntitiesInTimeRange(1.0, 3.0);
        console.log(`Entities active between t=1.0 and t=3.0: ${Array.from(entitiesInRange.keys()).join(', ')}`);
        
        // Test entity state at specific times
        if (entityIds.length > 0) {
            const entityId = entityIds[0];
            
            // Test at various times
            for (const time of [0.5, 1.2, 2.0, 3.0, 4.5]) {
                const state = animData.getEntityStateAtTime(entityId, time);
                if (state) {
                    console.log(`Entity ${entityId} at t=${time}: State=${state.state}, Position=(${state.x.toFixed(1)}, ${state.y.toFixed(1)})`);
                } else {
                    console.log(`Entity ${entityId} not active at t=${time}`);
                }
            }
        }
        
        console.log('Entity path tests completed successfully');
        
        // Test statistics functionality
        console.log('\n--- Statistics Tests ---');
        
        // Get all available statistics
        const availableStats = animData.getAvailableStatistics();
        console.log(`Available statistics: ${availableStats.join(', ')}`);
        
        if (availableStats.length > 0) {
            // Test getting a specific statistic
            const queueStat = animData.getStatistic('activity_metric', 'act1', 'queueLength');
            if (queueStat) {
                console.log(`Found queue length statistic with ${queueStat.timeSeries.length} data points`);
                
                // Test getting a value at a specific time
                for (let time = 0; time <= 10; time += 2.5) {
                    const value = animData.getStatisticValueAtTime('activity_metric', 'act1', 'queueLength', time);
                    console.log(`Queue length at t=${time}: ${value}`);
                }
                
                // Test getting a time series for a range
                const timeSeries = animData.getStatisticTimeSeriesForRange(
                    'activity_metric', 'act1', 'queueLength', 2.0, 8.0
                );
                console.log(`Time series from t=2.0 to t=8.0: ${timeSeries.map(p => `${p.time}=${p.value}`).join(', ')}`);
                
                // Test getting summary statistics
                const summary = animData.getStatisticSummary('activity_metric', 'act1', 'queueLength');
                if (summary) {
                    console.log(`Queue length stats - Min: ${summary.min}, Max: ${summary.max}, Mean: ${summary.mean.toFixed(2)}`);
                }
            }
        }
        
    } catch (err) {
        console.error('Test failed:', err);
    }
    
    console.log('=== Test Complete ===');
}

// Run the tests
runStandaloneTest();
runEntityPathTest().catch(console.error);