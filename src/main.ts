import { AnimationData } from './animation-data/AnimationData';
import { NodeFileReader } from './animation-data/loaders/NodeFileReader';
import * as path from 'path';

/**
 * Tests the AnimationData class with local files
 */
async function runStandaloneTest() {
    console.log('--- Starting AnimationData Standalone Test ---');
    
    // Path to our test data directory
    // Using the root directory of the grocery store simulation project
    const studyPath = 'C:\\_source\\grocery-store-simulation\\animation-app\\public';
    console.log(`Targeting study path: ${studyPath}`);
    
    try {
        // Create a file reader pointing to our test data
        const nodeReader = new NodeFileReader(studyPath);
        
        // Verify that critical files exist
        const modelLayoutPath = 'model_layout.json';
        const visualConfigPath = 'replications/rep_001/visual_config.json';
        
        const modelLayoutFullPath = nodeReader.resolveFullPath(modelLayoutPath);
        const visualConfigFullPath = nodeReader.resolveFullPath(visualConfigPath);
        
        console.log(`Checking model layout at: ${modelLayoutFullPath}`);
        console.log(`Checking visual config at: ${visualConfigFullPath}`);
        
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
        }
        
        // Check if we have visual configuration
        if (animData.sharedVisualConfig) {
            console.log(`Shared Visual Config Loaded: Background mode "${animData.sharedVisualConfig.backgroundMode}"`);
        }
        
        // Set active replication to ID 1
        await animData.setActiveReplication(1);
        
        // Display entity path information
        const entityIds = animData.getLoadedEntityIds();
        console.log(`\nLoaded Entity Paths (${entityIds.length} entities):`);
        
        entityIds.forEach(entityId => {
            const state = animData.getEntityStateAtTime(entityId, 0);
            const entityType = animData.getEntitiesByType(state?.state || '').has(entityId) ? state?.state : 'unknown';
            console.log(`  Entity ${entityId} (Type: ${entityType}):`);
            
            // Get entity path points
            const path = animData.getEntitiesInTimeRange(0, 3600).get(entityId);
            if (path) {
                const firstPoint = path.path[0];
                const lastPoint = path.path[path.path.length - 1];
                console.log(`    Start: (${firstPoint.x}, ${firstPoint.y}) at time ${firstPoint.clock}`);
                console.log(`    End: (${lastPoint.x}, ${lastPoint.y}) at time ${lastPoint.clock}`);
                console.log(`    Total path points: ${path.path.length}`);
                
                // Show some activities along the path
                console.log('    Key activities:');
                path.path
                    .filter(point => point.event && point.event !== '')
                    .forEach(point => {
                        console.log(`      - ${point.event} at time ${point.clock} (state: ${point.state})`);
                    });
            }
        });
        
        // Show some time-based queries
        console.log('\nEntity States at Different Times:');
        [0, 30, 60, 90].forEach(time => {
            const activeEntities = Array.from(animData.getEntityIdsAtTime(time));
            console.log(`\nTime ${time} - Active Entities: ${activeEntities.length}`);
            activeEntities.forEach(entityId => {
                const state = animData.getEntityStateAtTime(entityId, time);
                if (state) {
                    console.log(`  ${entityId}: ${state.state} at (${Math.round(state.x)}, ${Math.round(state.y)})`);
                }
            });
        });
        
    } catch (err) {
        console.error("\n--- Test Failed ---");
        console.error(err);
    }
    
    console.log('\n--- Test Complete ---');
}

async function runEntityPathTest() {
    console.log('=== AnimationData Entity Path Test ===');
    
    const studyPath = path.normalize('C:/_source/grocery-store-simulation/animation-app/public');
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
// runEntityPathTest().catch(console.error);