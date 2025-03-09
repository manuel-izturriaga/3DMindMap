document.addEventListener('DOMContentLoaded', () => {
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('scene-container').appendChild(renderer.domElement);

    // Orbit controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;
    controls.maxDistance = 50; // Increased max distance

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
    });

    // Floating node setup (sphere)
    //const nodeGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    //const nodeMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 }); // Green color
    //const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
    //node.position.set(0, 2, 0); // Position the node in the room
    //scene.add(node);

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

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
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
    });

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

        material = new THREE.MeshLambertMaterial({ color: color });
        const node = new THREE.Mesh(geometry, material);

        // Random position
        node.position.set(
            Math.random() * 6 - 3,
            Math.random() * 4,
            Math.random() * 6 - 3
        );

        scene.add(node);
    }
});
