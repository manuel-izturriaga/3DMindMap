document.addEventListener('DOMContentLoaded', () => {
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
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
    loadButton.style.cursor = 'pointer';
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
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;
    controls.maxDistance = 50; // Increased max distance
    
    // Store all nodes for selection
    const nodes = [];

    // Room setup (simple box)
    const roomSize = 30; // Increased room size
    const roomHeight = 20;
    const roomGeometry = new THREE.BoxGeometry(roomSize, roomHeight, roomSize);
    const roomMaterial = new THREE.MeshLambertMaterial({ color: 0x808080, side: THREE.BackSide }); // Grey color
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
    const pointLight = new THREE.PointLight(0xffffff, 0.5, 20); // Reduced intensity, increased distance
    pointLight.position.set(0, 8, 0); // Increased height
    scene.add(pointLight);

    // Directional lights
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight1.position.set(5, 10, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-5, 10, -5);
    scene.add(directionalLight2);

    // Camera position (inside the room)
    camera.position.set(0, 5, 14); // Adjusted position
    controls.update();

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
        const title = document.createElement('h3');
        title.textContent = node.userData.category;
        title.style.margin = '0 0 10px 0';
        title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.3)';
        title.style.paddingBottom = '5px';
        infoPane.appendChild(title);
        
        // Create text area for notes
        const notes = document.createElement('textarea');
        notes.placeholder = 'Add your notes here...';
        notes.value = node.userData.notes || '';
        notes.style.width = '100%';
        notes.style.height = '80px';
        notes.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        notes.style.color = 'white';
        notes.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        notes.style.borderRadius = '3px';
        notes.style.padding = '5px';
        notes.style.marginBottom = '10px';
        notes.style.resize = 'vertical';
        infoPane.appendChild(notes);
        
        // Save notes to node userData when changed
        notes.addEventListener('input', () => {
            node.userData.notes = notes.value;
        });
        
        // Create close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.backgroundColor = '#f44336';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '3px';
        closeButton.style.padding = '5px 10px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.float = 'right';
        infoPane.appendChild(closeButton);
        
        // Close button event
        closeButton.addEventListener('click', () => {
            infoPane.style.display = 'none';
            activeInfoPane = null;
        });
        
        // Store the pane in the map
        infoPanes.set(node, infoPane);
        
        return infoPane;
    }
    
    // Function to update info pane positions
    function updateInfoPanesPositions() {
        nodes.forEach(node => {
            if (infoPanes.has(node)) {
                const infoPane = infoPanes.get(node);
                if (infoPane.style.display !== 'none') {
                    // Convert 3D position to screen position
                    const vector = new THREE.Vector3();
                    vector.setFromMatrixPosition(node.matrixWorld);
                    vector.project(camera);
                    
                    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
                    
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
            opacity: 0.7,
            transparent: true,
            linewidth: 1
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
                        const node = createNodeFromData(
                            nodeData.category, 
                            nodeData.position,
                            nodeData.notes
                        );
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
    
    // Function to create a node from loaded data
    function createNodeFromData(category, position, notes) {
        let geometry;
        let material;
        let color;
        const nodeSize = 0.3; // Reduced node size

        switch (category) {
            case 'Trigger':
                geometry = new THREE.BoxGeometry(nodeSize, nodeSize, nodeSize);
                color = 0xff0000; // Red
                break;
            case 'Thoughts':
                geometry = new THREE.SphereGeometry(nodeSize, 32, 32);
                color = 0x00ff00; // Green
                break;
            case 'Theme':
                geometry = new THREE.ConeGeometry( nodeSize, nodeSize * 2, 32 );
                color = 0x0000ff; // Blue
                break;
            case 'Feeling':
                geometry = new THREE.CylinderGeometry( nodeSize, nodeSize, nodeSize * 2, 32 );
                color = 0xffff00; // Yellow
                break;
            case 'Whys':
                geometry = new THREE.TetrahedronGeometry(nodeSize);
                color = 0xff00ff; // Magenta
                break;
            case 'Solutions':
                geometry = new THREE.OctahedronGeometry(nodeSize);
                color = 0x00ffff; // Cyan
                break;
            case 'Root Emotions':
                geometry = new THREE.DodecahedronGeometry(nodeSize);
                color = 0xffa500; // Orange
                break;
            default:
                geometry = new THREE.SphereGeometry(nodeSize, 32, 32);
                color = 0xffffff; // White
                break;
        }

        material = new THREE.MeshLambertMaterial({ 
            color: color,
            emissive: 0x000000,
            emissiveIntensity: 0.5
        });
        
        const node = new THREE.Mesh(geometry, material);
        
        // Add user data for node information
        node.userData = {
            category: category,
            isHighlighted: false,
            notes: notes || ''
        };

        // Set position
        node.position.set(
            position.x,
            position.y,
            position.z
        );

        scene.add(node);
        
        // Add to nodes array for selection
        nodes.push(node);
        
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
            
            // Handle right-click for dragging
            if (event.button === 2) {
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
                        activeInfoPane.style.display = 'none';
                    }
                    
                    const infoPane = createInfoPane(clickedNode);
                    infoPane.style.display = 'block';
                    activeInfoPane = infoPane;
                    
                    // Update position
                    const vector = new THREE.Vector3();
                    vector.setFromMatrixPosition(clickedNode.matrixWorld);
                    vector.project(camera);
                    
                    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
                    
                    infoPane.style.left = `${x + 20}px`;
                    infoPane.style.top = `${y - 20}px`;
                }
            }
        } else if (isConnectingMode && sourceNode) {
            // Clicked empty space while in connecting mode with a source node selected
            // Reset highlight on source node
            sourceNode.material.emissive.setHex(0x000000);
            sourceNode.userData.isHighlighted = false;
            
            // Reset source node
            sourceNode = null;
        } else if (!isConnectingMode && activeInfoPane) {
            // Clicked empty space while info pane is open
            activeInfoPane.style.display = 'none';
            activeInfoPane = null;
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

    // Node creation logic
    const nodeCreationButtons = document.querySelectorAll('#node-creation button');
    nodeCreationButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.dataset.category;
            createNode(category);
        });
    });

    function createNode(category) {
        let geometry;
        let material;
        let color;
        const nodeSize = 0.3; // Reduced node size

        switch (category) {
            case 'Trigger':
                geometry = new THREE.BoxGeometry(nodeSize, nodeSize, nodeSize);
                color = 0xff0000; // Red
                break;
            case 'Thoughts':
                geometry = new THREE.SphereGeometry(nodeSize, 32, 32);
                color = 0x00ff00; // Green
                break;
            case 'Theme':
                geometry = new THREE.ConeGeometry( nodeSize, nodeSize * 2, 32 );
                color = 0x0000ff; // Blue
                break;
            case 'Feeling':
                geometry = new THREE.CylinderGeometry( nodeSize, nodeSize, nodeSize * 2, 32 );
                color = 0xffff00; // Yellow
                break;
            case 'Whys':
                geometry = new THREE.TetrahedronGeometry(nodeSize);
                color = 0xff00ff; // Magenta
                break;
            case 'Solutions':
                geometry = new THREE.OctahedronGeometry(nodeSize);
                color = 0x00ffff; // Cyan
                break;
            case 'Root Emotions':
                geometry = new THREE.DodecahedronGeometry(nodeSize);
                color = 0xffa500; // Orange
                break;
            default:
                geometry = new THREE.SphereGeometry(nodeSize, 32, 32);
                color = 0xffffff; // White
                break;
        }

        material = new THREE.MeshLambertMaterial({ 
            color: color,
            emissive: 0x000000,
            emissiveIntensity: 0.5
        });
        
        const node = new THREE.Mesh(geometry, material);
        
        // Add user data for node information
        node.userData = {
            category: category,
            isHighlighted: false,
            notes: ''
        };

        // Random position
        node.position.set(
            Math.random() * 6 - 3,
            Math.random() * 4,
            Math.random() * 6 - 3
        );

        scene.add(node);
        
        // Add to nodes array for selection
        nodes.push(node);
        
        return node;
    }
});
