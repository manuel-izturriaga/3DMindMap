document.addEventListener('DOMContentLoaded', () => {
    // Scene setup
    const scene = new THREE.Scene();

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('scene-container').appendChild(renderer.domElement);

    // Raycaster for node selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Variables for node dragging
    let isDragging = false;
    let selectedNode = null;
    let dragPlane = null;
    let dragOffset = new THREE.Vector3();

    // Variables for node connections
    let isConnectingMode = false;
    let sourceNode = null;
    let connections = [];
    
    // Variables for node info panes
    let activeInfoPane = null;
    const infoPanes = new Map(); // Map to store node -> info pane relationships
    
    // Variables for node creation
    let selectedNodeType = null;
    
    // Create save/load container
    const saveLoadContainer = document.createElement('div');
    saveLoadContainer.id = 'save-load-container';
    saveLoadContainer.style.position = 'absolute';
    saveLoadContainer.style.bottom = '10px';
    saveLoadContainer.style.right = '10px';
    saveLoadContainer.style.zIndex = '100';
    saveLoadContainer.style.display = 'flex';
    saveLoadContainer.style.gap = '10px';
    document.body.appendChild(saveLoadContainer);
    
    // Create save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save Mind Map';
    saveButton.style.padding = '8px 12px';
    saveButton.style.backgroundColor = '#2196F3';
    saveButton.style.color = 'white';
    saveButton.style.border = 'none';
    saveButton.style.borderRadius = '4px';
    saveButton.style.cursor = 'pointer';
    saveLoadContainer.appendChild(saveButton);
    
    // Create load button
    const loadButton = document.createElement('button');
    loadButton.textContent = 'Load Mind Map';
    loadButton.style.padding = '8px 12px';
    loadButton.style.backgroundColor = '#9C27B0';
    loadButton.style.color = 'white';
    loadButton.style.border = 'none';
    loadButton.style.borderRadius = '4px';
    saveLoadContainer.appendChild(loadButton);
    
    // Create connection mode toggle button
    const connectModeButton = document.createElement('button');
    connectModeButton.textContent = 'Connect Nodes: OFF';
    connectModeButton.style.position = 'absolute';
    connectModeButton.style.top = '10px';
    connectModeButton.style.right = '10px';
    connectModeButton.style.zIndex = '100';
    connectModeButton.style.padding = '8px 12px';
    connectModeButton.style.backgroundColor = '#4CAF50';
    connectModeButton.style.color = 'white';
    connectModeButton.style.border = 'none';
    connectModeButton.style.borderRadius = '4px';
    connectModeButton.style.cursor = 'pointer';
    document.body.appendChild(connectModeButton);
    
    // Toggle connection mode
    connectModeButton.addEventListener('click', () => {
        isConnectingMode = !isConnectingMode;
        connectModeButton.textContent = isConnectingMode ? 'Connect Nodes: ON' : 'Connect Nodes: OFF';
        connectModeButton.style.backgroundColor = isConnectingMode ? '#f44336' : '#4CAF50';
        
        // Reset source node when toggling off
        if (!isConnectingMode) {
            sourceNode = null;
            // Reset any highlighted nodes
            nodes.forEach(node => {
                if (node.userData.isHighlighted) {
                    node.material.emissive.setHex(0x000000);
                    node.userData.isHighlighted = false;
                }
            });
        }
    });

    // Orbit controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    //controls.dampingFactor = 0.05;
    //controls.screenSpacePanning = false;
    //controls.minDistance = 5;
    //controls.maxDistance = 50; // Increased max distance
    
    // Store all nodes for selection
    const nodes = [];

    let showAllInfoPanes = false;

    // Function to update info pane visibility
    function updateInfoPaneVisibility(showAll) {
        infoPanes.forEach((infoPane, node) => {
            const titleElement = infoPane.querySelector('#title');
            const contentElement = infoPane.querySelector('#content');
            const notesElement = infoPane.querySelector('textarea');
            const deleteButton = infoPane.querySelector('#delete-button');
            const closeButton = infoPane.querySelector('#close-button');
            const categoryDropdown = infoPane.querySelector('select');
    
            if (showAll) {
                // Show title, hide content
                titleElement.style.display = 'block';
                contentElement.style.display = 'none';
                infoPane.style.display = 'block';
            } else {
                // Hide all
                titleElement.style.display = 'none';
                contentElement.style.display = 'none';
                infoPane.style.display = 'none';
            }
            updateInfoPanesPositions();
        });
    }

    // Create toggle all info panes button
    const toggleAllInfoPanesButton = document.createElement('button');
    toggleAllInfoPanesButton.textContent = 'Show All Titles';
    toggleAllInfoPanesButton.style.position = 'absolute';
    toggleAllInfoPanesButton.style.top = '50px';
    toggleAllInfoPanesButton.style.right = '10px';
    toggleAllInfoPanesButton.style.zIndex = '100';
    toggleAllInfoPanesButton.style.padding = '8px 12px';
    toggleAllInfoPanesButton.style.backgroundColor = '#2196F3';
    toggleAllInfoPanesButton.style.color = 'white';
    toggleAllInfoPanesButton.style.border = 'none';
    toggleAllInfoPanesButton.style.borderRadius = '4px';
    toggleAllInfoPanesButton.style.cursor = 'pointer';
    document.body.appendChild(toggleAllInfoPanesButton);

    // Toggle all info panes
    toggleAllInfoPanesButton.addEventListener('click', () => {
        showAllInfoPanes = !showAllInfoPanes;
        toggleAllInfoPanesButton.textContent = showAllInfoPanes ? 'Show Titles: ON' : 'Show Titles: OFF';
        toggleAllInfoPanesButton.style.backgroundColor = showAllInfoPanes ? '#f44336' : '#2196F3';
        updateInfoPaneVisibility(showAllInfoPanes);
    });

    // Room setup (simple box)
    const roomSize = 30; // Increased room size
    const roomHeight = 20;
    const roomGeometry = new THREE.BoxGeometry(roomSize, roomHeight, roomSize);
    const roomMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.BackSide }); // Grey color
    const room = new THREE.Mesh(roomGeometry, roomMaterial);
    scene.add(room);

    // Constrain camera movement
    controls.addEventListener('change', () => {
        // Keep camera within the room bounds
        const halfRoomSize = roomSize / 2;
        const halfRoomHeight = roomHeight / 2;

        camera.position.x = Math.max(-halfRoomSize + 1, Math.min(halfRoomSize - 1, camera.position.x));
        camera.position.y = Math.max(-halfRoomHeight + 1, Math.min(halfRoomHeight - 1, camera.position.y));
        camera.position.z = Math.max(-halfRoomSize + 1, Math.min(halfRoomSize - 1, camera.position.z));
        
        // Update info panes positions when camera moves
        updateInfoPanesPositions();
    });

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
    scene.add(ambientLight);

    // Point light above the node
    const pointLight = new THREE.PointLight(0xffffff, 1, 2); // Reduced intensity, increased distance
    scene.add(pointLight);

    // Directional lights
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight1.position.set(5, 10, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight2.position.set(-5, 10, -5);
    scene.add(directionalLight2);

    // Camera position (inside the room)
    camera.position.set(0, 5, 14); // Adjusted position
    controls.update();

    // Store initial camera position and target
    const initialCameraPosition = new THREE.Vector3().copy(camera.position);
    const initialControlsTarget = new THREE.Vector3().copy(controls.target);

    // Create return to start button
    const returnToStartButton = document.createElement('button');
    returnToStartButton.textContent = 'Return to Start';
    returnToStartButton.style.position = 'absolute';
    returnToStartButton.style.top = '10px';
    returnToStartButton.style.left = '10px';
    returnToStartButton.style.zIndex = '100';
    returnToStartButton.style.padding = '8px 12px';
    returnToStartButton.style.backgroundColor = '#4CAF50';
    returnToStartButton.style.color = 'white';
    returnToStartButton.style.border = 'none';
    returnToStartButton.style.borderRadius = '4px';
    returnToStartButton.style.cursor = 'pointer';
    document.body.appendChild(returnToStartButton);

    // Return to start button event listener
    returnToStartButton.addEventListener('click', () => {
        camera.position.copy(initialCameraPosition);
        controls.target.copy(initialControlsTarget);
        controls.update();
    });

    // Function to create an info pane for a node
    function createInfoPane(node) {
        // Check if pane already exists
        if (infoPanes.has(node)) {
            return infoPanes.get(node);
        }
        
        // Create info pane container
        const infoPane = document.createElement('div');
        infoPane.className = 'node-info-pane';
        infoPane.style.position = 'absolute';
        infoPane.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        infoPane.style.color = 'white';
        infoPane.style.padding = '10px';
        infoPane.style.borderRadius = '5px';
        infoPane.style.width = '200px';
        infoPane.style.zIndex = '50';
        infoPane.style.display = 'none';
        infoPane.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5)';
        document.body.appendChild(infoPane);
        
        // Create title based on node category
        const titleSpace = document.createElement('div');
        titleSpace.id = 'title';
        infoPane.appendChild(titleSpace);

        const title = document.createElement('h3');
        title.textContent = node.userData.title;
        title.style.margin = '0 0 10px 0';
        title.style.alignContent = 'center';
        title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.3)';
        title.style.paddingBottom = '5px';
        titleSpace.appendChild(title);

        // Create content container
        const content = document.createElement('div');
        content.id = 'content';
        infoPane.appendChild(content);

        // Create category dropdown
        const categoryDropdown = document.createElement('select');
        categoryDropdown.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        categoryDropdown.style.color = 'white';
        categoryDropdown.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        categoryDropdown.style.borderRadius = '3px';
        categoryDropdown.style.padding = '5px';
        categoryDropdown.style.margin = '5px';

        // Get unique categories
        const uniqueCategories = [...new Set(nodes.map(node => node.userData.category))];

        // Populate dropdown with categories
        uniqueCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryDropdown.appendChild(option);
        });

        // Set current category as selected
        categoryDropdown.value = node.userData.category;

        content.appendChild(categoryDropdown);

        // Category dropdown event listener
        categoryDropdown.addEventListener('change', () => {
            node.userData.category = categoryDropdown.value;
            
            // Update node geometry and material
            scene.remove(node);
            node.geometry.dispose();
            node.material.dispose();
            
            const newNode = createNode(node.userData.category, node.position, node.userData.notes, node.userData.title, true);
            scene.add(newnode);
            
            updateJsonDisplay();
            updateCategoryFilter();
        });
        
        // Create text area for notes
        const notes = document.createElement('textarea');
        notes.placeholder = 'Add your notes here...';
        notes.value = node.userData.notes || '';
        notes.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        notes.style.color = 'white';
        notes.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        notes.style.borderRadius = '3px';
        notes.style.width = 'auto';
        notes.style.padding = '5px';
        notes.style.resize = 'vertical';
        notes.style.margin = '5px';
        content.appendChild(notes);
        
        // Save notes to node userData when changed
        notes.addEventListener('input', () => {
            node.userData.notes = notes.value;
        });

        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.id = 'delete-button';
        deleteButton.textContent = 'Delete Node';
        deleteButton.style.backgroundColor = '#f44336';
        deleteButton.style.color = 'white';
        deleteButton.style.border = 'none';
        deleteButton.style.borderRadius = '3px';
        deleteButton.style.padding = '5px 10px';
        deleteButton.style.cursor = 'pointer';
        deleteButton.style.float = 'left';
        content.appendChild(deleteButton);
    
        // Delete button event
        deleteButton.addEventListener('click', () => {
            deleteNode(node, nodes, scene, connections, infoPanes);
        });
        
        // Create close button
        const closeButton = document.createElement('button');
        closeButton.id = 'close-button';
        closeButton.textContent = 'Close';
        closeButton.style.backgroundColor = '#f44336';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '3px';
        closeButton.style.padding = '5px 10px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.float = 'right';
        content.appendChild(closeButton);
        
        // Close button event
        closeButton.addEventListener('click', () => {
            infoPane.style.display = 'none';
            activeInfoPane = false;
        });

        // Last Edited (Read-only for now)
        const lastEditedLabel = document.createElement('p');
        lastEditedLabel.textContent = `Last Edited: ${node.userData.lastEdited ? node.userData.lastEdited : 'Not yet edited'}`;
        lastEditedLabel.style.margin = '5px 0';
        content.appendChild(lastEditedLabel);
        
        // Store the pane in the map
        infoPanes.set(node, infoPane);
        
        return infoPane;
    }
    
    // Function to update info pane positions
    function updateInfoPanesPositions() {
        nodes.forEach(node => {
            if (infoPanes.has(node)) {
                const infoPane = infoPanes.get(node);
                if (showAllInfoPanes || infoPane.style.display !== 'none') {
                    // Convert 3D position to screen position
                    const vector = new THREE.Vector3();
                    vector.setFromMatrixPosition(node.matrixWorld);
                    vector.project(camera);
                    
                    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
                    
                    // Calculate distance from camera
                    const distance = camera.position.distanceTo(node.position);
                    
                    // Calculate scale factor (adjust these values as needed)
                    const baseScale = 1;
                    const maxScale = 2;
                    const minScale = 0.5;
                    const scale = Math.max(minScale, Math.min(maxScale, baseScale / (distance / 10))); // Adjust divisor for scaling speed
                    
                    // Apply scale to info pane
                    infoPane.style.transform = `scale(${scale})`;

                    const maxWidth = 200; // Maximum width in pixels
                    const maxHeight = 150; // Maximum height in pixels

                    // Calculate scaled dimensions
                    const scaledWidth = maxWidth / scale;
                    const scaledHeight = maxHeight / scale;


                    infoPane.style.width = `${scaledWidth}px`;
                    infoPane.style.height = `${scaledHeight}px`;
                    infoPane.style.fontSize = `${12 / scale}px`;

                    // Position the info pane next to the node
                    infoPane.style.left = `${x + 20}px`;
                    infoPane.style.top = `${y - 20}px`;
                }
            }
        });
    }

    // Function to create a connection between two nodes
    function createConnection(nodeA, nodeB) {
        // Check if connection already exists
        const connectionExists = connections.some(conn => 
            (conn.nodeA === nodeA && conn.nodeB === nodeB) || 
            (conn.nodeA === nodeB && conn.nodeB === nodeA)
        );
        
        if (connectionExists) return;
        
        // Create a line geometry
        const points = [
            nodeA.position.clone(),
            nodeB.position.clone()
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Create line material
        const material = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            opacity: 1,
            transparent: true,
            linewidth: 3
        });
        
        // Create the line
        const line = new THREE.Line(geometry, material);
        scene.add(line);
        
        // Store the connection
        connections.push({
            nodeA: nodeA,
            nodeB: nodeB,
            line: line
        });
        
        // Update node sizes
        //updateNodeSize(nodeA);
        //updateNodeSize(nodeB);
        updateJsonDisplay();
    }
    
    // Function to update connection lines
    function updateConnections() {
        connections.forEach(connection => {
            const points = [
                connection.nodeA.position.clone(),
                connection.nodeB.position.clone()
            ];
            
            // Update line geometry
            connection.line.geometry.dispose();
            connection.line.geometry = new THREE.BufferGeometry().setFromPoints(points);
        });
    }
    
    // Function to save the mind map
    function saveMindMap() {
        const data = {
            nodes: nodes.map(node => ({
                category: node.userData.category,
                title: node.userData.title || 'Untitled',
                notes: node.userData.notes || '',
                position: {
                    x: node.position.x,
                    y: node.position.y,
                    z: node.position.z
                }
            })),
            connections: connections.map(conn => ({
                nodeAIndex: nodes.indexOf(conn.nodeA),
                nodeBIndex: nodes.indexOf(conn.nodeB)
            }))
        };
        
        // Convert to JSON string
        const jsonString = JSON.stringify(data, null, 2);
        
        // Create a blob and download link
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'mindmap.json';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Clean up
        URL.revokeObjectURL(url);

        updateJsonDisplay();
    }
    
    // Function to load the mind map
    function loadMindMap() {
        // Create file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // Clear existing nodes and connections
                    clearMindMap();
                    
                    // Create nodes
                    data.nodes.forEach(nodeData => {
                        const node = createNode(
                            nodeData.category, 
                            nodeData.position,
                            nodeData.notes,
                            nodeData.title,
                            true // loadedData flag
                        );
                        createInfoPane(node);
                    });
                    
                    // Create connections
                    data.connections.forEach(conn => {
                        if (conn.nodeAIndex >= 0 && conn.nodeAIndex < nodes.length &&
                            conn.nodeBIndex >= 0 && conn.nodeBIndex < nodes.length) {
                            createConnection(nodes[conn.nodeAIndex], nodes[conn.nodeBIndex]);
                        }
                    });
                    
                } catch (error) {
                    console.error('Error loading mind map:', error);
                    alert('Error loading mind map. Please check the file format.');
                }
            };
            
            reader.readAsText(file);
            document.body.removeChild(fileInput);
        });
        
        fileInput.click();

        updateCategoryFilter();
        updateJsonDisplay();
    }
    
    // Function to clear the mind map
    function clearMindMap() {
        // Remove all connections
        connections.forEach(conn => {
            scene.remove(conn.line);
            conn.line.geometry.dispose();
            conn.line.material.dispose();
        });
        connections = [];
        
        // Remove all nodes
        nodes.forEach(node => {
            scene.remove(node);
            node.geometry.dispose();
            node.material.dispose();
            
            // Remove info panes
            if (infoPanes.has(node)) {
                const infoPane = infoPanes.get(node);
                document.body.removeChild(infoPane);
                infoPanes.delete(node);
            }
        });
        nodes.length = 0;
    }
    

    // Function to delete a node and its connections
    function deleteNode(node, nodes, scene, connections, infoPanes) {
        // Remove connections associated with the node
        for (let i = connections.length - 1; i >= 0; i--) {
            const connection = connections[i];
            if (connection.nodeA === node || connection.nodeB === node) {
                scene.remove(connection.line);
                connection.line.geometry.dispose();
                connection.line.material.dispose();
                connections.splice(i, 1);
            }
        }
        
        // Remove the node from the scene and the nodes array
        scene.remove(node);
        node.geometry.dispose();
        node.material.dispose();
        
        const index = nodes.indexOf(node);
        if (index > -1) {
            nodes.splice(index, 1);
        }
        
        // Remove the info pane
        if (infoPanes.has(node)) {
            const infoPane = infoPanes.get(node);
            document.body.removeChild(infoPane);
            infoPanes.delete(node);
        }
    }

    // Helper function to calculate node size based on connections
    function calculateNodeSize(node) {
        const baseSize = 0.2;
        const connectionCount = connections.filter(conn => conn.nodeA === node || conn.nodeB === node).length;
        const sizeIncrease = connectionCount * 0.05; // Adjust the multiplier as needed
        return baseSize + sizeIncrease;
    }

    function createNode(category, position = '', notes = '', title = '', loadedData = false) {
        //console.log('Creating node with category:', category, 'position:', position, 'notes:', notes, 'title:', title);
        let geometry;
        let material;
        let color;
        let nodeSize = 0.2; // Reduced node size

        const now = new Date();
        const timestamp = now.toISOString(); // Use ISO format for date
        const dateString = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        // Calculate node size based on connections
        

        switch (category) {
            case 'Trigger':
                geometry = new THREE.OctahedronGeometry(nodeSize);
                color = 0xff0000; // Red
                break;
            case 'Event/Thought':
                geometry = new THREE.SphereGeometry(nodeSize, 32, 32);
                color = 0x00ff00; // Green
                break;
            case 'Theme':
                geometry = new THREE.DodecahedronGeometry(nodeSize*1.3);
                color = 0x0000ff; // Blue
                break;
            case 'Feeling':
                geometry = new THREE.IcosahedronGeometry(nodeSize*1.2);
                color = 0xffff00; // Yellow
                break;
            case 'Evidence':
                geometry = new THREE.SphereGeometry(nodeSize, 32, 32);
                //switch (evidence) {
                //    case 'Supportive':
                        color = 0xffffff; // Green
                //    case 'Conflicting':
                //        color = 0x000000; // Black
                //}
                break;
            case 'Questions':
                geometry = new THREE.SphereGeometry(nodeSize, 32, 32);
                color = 0xff00ff; // Magenta
                break;
            case 'Solutions':
                geometry = new THREE.SphereGeometry(nodeSize, 32, 32);
                color = 0x00ffff; // Cyan
                break;
            case 'Raw Emotion':
                geometry = new THREE.TorusGeometry(nodeSize, nodeSize/2,12, 20);
                color = 0xffa500; // Orange
                break;
            default:
                geometry = new THREE.SphereGeometry(nodeSize, 20, 15);
                color = 0xffffff; // White
                break;
        }

        material = new THREE.MeshLambertMaterial({ 
            color: color,
            emissive_color: 0x000000,
            //emiss
            //roughness: 0,
            //metalness: 1,
            //flatShading: true
        });
        
        const node = new THREE.Mesh(geometry, material);
        
        // Add user data for node information

        
        node.userData = {
            category: category,
            title: title,
            isHighlighted: false,
            notes: notes,
            dateAdded: timestamp,
            lastEdited: null,
            resolved: false
        };

        if (loadedData) {
            // Set position from loaded data
            node.position.set(
                position.x,
                position.y,
                position.z
            );
        }
        else {
            // Get the camera's position and direction
            const cameraPosition = new THREE.Vector3();
            cameraPosition.copy(camera.position);
            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);

            // Calculate the node's position in front of the camera
            const nodePosition = new THREE.Vector3();
            cameraPosition.x += Math.random() * 0.5 - 0.25;
            cameraPosition.y += Math.random() * 0.5 - 0.25;
            cameraPosition.z += Math.random() * 0.5 - 0.25;
            nodePosition.copy(cameraPosition).add(cameraDirection.multiplyScalar(5)); 
            
            node.position.copy(nodePosition); // Set the position of the node
            // Random position
            //node.position.set(
           //    Math.random() * 6 - 3,
            //    Math.random() * 4,
           //     Math.random() * 6 - 3
            //);
        }
        

        scene.add(node);
        
        // Add to nodes array for selection
        nodes.push(node);

        createInfoPane(node);
        updateJsonDisplay();
        updateCategoryFilter();
        
        return node;
    }

    
    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        
        // Update connections if any exist
        if (connections.length > 0) {
            updateConnections();
        }
        
        renderer.render(scene, camera);
    }

    animate();

    // Handle window resize
    window.addEventListener('resize', () => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;

        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(newWidth, newHeight);
        
        // Update info panes positions
        updateInfoPanesPositions();
    });

    // Mouse event handlers for node dragging and connecting
    renderer.domElement.addEventListener('contextmenu', (event) => {
        event.preventDefault(); // Prevent the default context menu
    });

    activeInfoPane = false; // Track if an info pane is open

    renderer.domElement.addEventListener('mousedown', (event) => {
        // Calculate mouse position in normalized device coordinates
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update the raycaster
        raycaster.setFromCamera(mouse, camera);
        
        // Check for intersections with nodes
        const intersects = raycaster.intersectObjects(nodes);
        
        if (intersects.length > 0) {
            const clickedNode = intersects[0].object;
            activePane = infoPanes.get(clickedNode)
            
            // Handle middle-click for dragging
            if (event.button === 1) {
                // Only allow dragging if not in connecting mode
                if (!isConnectingMode) {
                    // Disable orbit controls during dragging
                    controls.enabled = false;
                    
                    // Select the first intersected node
                    selectedNode = clickedNode;
                    
                    // Create a drag plane perpendicular to the camera view
                    const planeNormal = new THREE.Vector3().copy(camera.getWorldDirection(new THREE.Vector3()));
                    dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
                        planeNormal,
                        selectedNode.position
                    );
                    
                    // Calculate the offset from the intersection point to the node position
                    const intersectionPoint = new THREE.Vector3();
                    raycaster.ray.intersectPlane(dragPlane, intersectionPoint);
                    dragOffset.copy(selectedNode.position).sub(intersectionPoint);
                    
                    isDragging = true;
                }
            }
            // Handle left-click for connecting or showing info pane
            else if (event.button === 0) {
                if (isConnectingMode) {
                    if (!sourceNode) {
                        // First node selection
                        sourceNode = clickedNode;
                        
                        // Highlight the selected node
                        sourceNode.userData.isHighlighted = true;
                        sourceNode.material.emissive.setHex(0x555555);
                    } else if (sourceNode !== clickedNode) {
                        // Second node selection - create connection
                        createConnection(sourceNode, clickedNode);
                        
                        // Reset highlight on source node
                        sourceNode.material.emissive.setHex(0x000000);
                        sourceNode.userData.isHighlighted = false;
                        
                        // Reset source node
                        sourceNode = null;
                    }
                } else {
                    // Show info pane for the clicked node
                    if (activeInfoPane) {
                        activePane.style.display = 'none';
                        activeInfoPane = false;
                    } else {
                        activePane.style.display = 'block';
                        activeInfoPane = true;
                    }
                    
                    // Update position
                    const vector = new THREE.Vector3();
                    vector.setFromMatrixPosition(clickedNode.matrixWorld);
                    vector.project(camera);
                    
                    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
                    
                    activePane.style.left = `${x + 20}px`;
                    activePane.style.top = `${y - 20}px`;
                }
            }
        } else if (isConnectingMode && sourceNode) {
            // Clicked empty space while in connecting mode with a source node selected
            sourceNode.material.emissive.setHex(0x000000);
            sourceNode.userData.isHighlighted = false;
            
            // Reset source node
            sourceNode = null;
            
        } else if (!isConnectingMode && activeInfoPane) {
            // Clicked empty space while info pane is open
            activePane.style.display = 'none';
            activePane = null;
        }
    });

    renderer.domElement.addEventListener('mousemove', (event) => {
        if (!isDragging || !selectedNode) return;
        
        // Calculate mouse position in normalized device coordinates
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update the raycaster
        raycaster.setFromCamera(mouse, camera);
        
        // Find the intersection point with the drag plane
        const intersectionPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(dragPlane, intersectionPoint);
        
        // Apply the offset and update the node position
        selectedNode.position.copy(intersectionPoint.add(dragOffset));
        
        // Constrain node position to room bounds
        const halfRoomSize = roomSize / 2 - 1;
        const halfRoomHeight = roomHeight / 2 - 1;
        
        selectedNode.position.x = Math.max(-halfRoomSize, Math.min(halfRoomSize, selectedNode.position.x));
        selectedNode.position.y = Math.max(-halfRoomHeight, Math.min(halfRoomHeight, selectedNode.position.y));
        selectedNode.position.z = Math.max(-halfRoomSize, Math.min(halfRoomSize, selectedNode.position.z));
        
        // Update info pane position if it's open for the selected node
        if (infoPanes.has(selectedNode) && infoPanes.get(selectedNode).style.display !== 'none') {
            updateInfoPanesPositions();
        }
    });

    renderer.domElement.addEventListener('mouseup', (event) => {
        // Only handle right mouse button (button 2) for dragging
        if (event.button !== 2) return;
        
        // Re-enable orbit controls
        controls.enabled = true;
        
        // Reset dragging state
        isDragging = false;
        selectedNode = null;
        dragPlane = null;
    });
    
    // Save button event
    saveButton.addEventListener('click', saveMindMap);
    
    // Load button event
    loadButton.addEventListener('click', loadMindMap);

    // Node creation logic - updated for new workflow
    const nodeTypeButtons = document.querySelectorAll('.node-type-btn');
    
    const addNodeButton = document.getElementById('add-node-btn');
    
    // Node type selection
    nodeTypeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove selected class from all buttons
            nodeTypeButtons.forEach(btn => btn.classList.remove('selected'));
            
            // Add selected class to clicked button
            button.classList.add('selected');
            
            // Store selected category
            selectedNodeType = button.dataset.category;
            
            // Enable add node button
            addNodeButton.disabled = false;
        });
    });
    
    // Add node button
    addNodeButton.addEventListener('click', () => {
        if (!selectedNodeType) return;
        const nodeTitleInput = document.getElementById('node-title-input');
        
        if (nodeTitleInput) {
            
            const titleInput = nodeTitleInput.value.trim();
            console.log('Creating node with title:', titleInput);
            createNode(selectedNodeType, undefined, undefined, titleInput);
            nodeTitleInput.value = '';
        } else {
            console.error('Node title input element not found');
        }
        
    });

    const nodeTitleInput = document.getElementById('node-title-input');
    nodeTitleInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            //event.preventDefault(); // Prevent form submission
            addNodeButton.click(); // Trigger the add node button click event
        }
    });

    // Create category filter dropdown
    const categoryFilter = document.createElement('select');
    categoryFilter.id = 'category-filter';
    categoryFilter.style.position = 'absolute';
    categoryFilter.style.bottom = '775px';
    categoryFilter.style.left = '10px';
    categoryFilter.style.zIndex = '101';
    document.body.appendChild(categoryFilter);

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    defaultOption.textContent = 'All Categories';
    categoryFilter.appendChild(defaultOption);

    // Create JSON display container
    const jsonDisplayContainer = document.createElement('div');
    jsonDisplayContainer.id = 'json-display-container';
    jsonDisplayContainer.style.position = 'absolute';
    jsonDisplayContainer.style.bottom = '10px';
    jsonDisplayContainer.style.left = '10px';
    jsonDisplayContainer.style.zIndex = '100';
    jsonDisplayContainer.style.width = '300px';
    jsonDisplayContainer.style.height = '750px';
    jsonDisplayContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    jsonDisplayContainer.style.color = 'white';
    jsonDisplayContainer.style.padding = '10px';
    jsonDisplayContainer.style.borderRadius = '5px';
    jsonDisplayContainer.style.overflow = 'auto';
    document.body.appendChild(jsonDisplayContainer);

    // Function to update JSON display
    function updateJsonDisplay() {
        const selectedCategory = categoryFilter.value;

        let filteredNodes = nodes;

        if (selectedCategory !== 'all') {
            filteredNodes = nodes.filter(node => node.userData.category === selectedCategory);
        }

        const data = {
            nodes: filteredNodes.map(node => ({
                category: node.userData.category,
                title: node.userData.title || 'Untitled',
                notes: node.userData.notes || '',
                //position: {
                //    x: node.position.x,
                //    y: node.position.y,
                //    z: node.position.z
                //}
            })),
            connections: connections.map(conn => ({
                nodeAIndex: nodes.indexOf(conn.nodeA),
                nodeBIndex: nodes.indexOf(conn.nodeB)
            }))
        };
        
        // Convert to JSON string
        const jsonString = JSON.stringify(data, null, 2);
		
		// Format the JSON for pretty display
        jsonDisplayContainer.innerHTML = '<pre>' + jsonString + '</pre>';
    }

    // Listen for changes in the category filter
    categoryFilter.addEventListener('change', updateJsonDisplay);

    // Function to update category filter dropdown
    function updateCategoryFilter() {
        // Clear existing options
        categoryFilter.innerHTML = '';

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = 'all';
        defaultOption.textContent = 'All Categories';
        categoryFilter.appendChild(defaultOption);

        // Get unique categories from nodes
        const uniqueCategories = [...new Set(nodes.map(node => node.userData.category))];

        // Populate dropdown with categories
        uniqueCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
    }

});
