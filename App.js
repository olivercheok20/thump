"use strict";

import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import * as React from "react";
import { AppState } from "react-native";
import { gsap, Quad } from 'gsap';
import {
  Scene,
  OrthographicCamera,
  Vector2,
  Raycaster,
  Plane,
  Vector3
} from "three";

export default function App() {
  let timeout;
  const appState = React.useRef(AppState.currentState);
  const [refresh, setRefresh] = React.useState('');

  React.useEffect(() => {
    AppState.addEventListener("change", nextAppState => {
      if (!(
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      )) {
        setRefresh('');
      }
    });

    // Clear the animation loop when the component unmounts
    return () => {
      clearTimeout(timeout);
    }
  }, []);

  const objects = [];
  var scene;
  var camera;
  var screenWidth;
  var screenHeight;
  var touches = {};
  var draggedObjects = {};
  var active = {};
  var canDrag = true;
  var maxDrag = 0;
  var quakes = [];

  // User adjustable variables
  var gravity = 5;
  var wavespeed = 20;
  var maxHeight = 3;
  var background = 0xffd1dc;
  const blockHeight = 3;

  const handleTouchStart = (e) => {
    console.log('Touch start:', e.nativeEvent.identifier);

    if (e.nativeEvent.identifier + 1 == maxDrag) {
      return;
    }

    if (e.nativeEvent.touches.length == e.nativeEvent.identifier + 1) {
      maxDrag = Math.max(maxDrag, e.nativeEvent.touches.length);
      active[e.nativeEvent.identifier] = true;
    } else {
      return;
    }

    const touch = new Vector2(
      (e.nativeEvent.locationX / screenWidth) * 2 - 1,
      - (e.nativeEvent.locationY / screenHeight) * 2 + 1
    );

    touches[e.nativeEvent.identifier] = touch;
    const raycaster = new Raycaster();
    raycaster.setFromCamera(touch, camera);

    var intersects = raycaster.intersectObjects(objects, false)
    
    if (intersects.length > 0) {
      const object = intersects[0].object;
      object.timeline.clear()
      draggedObjects[e.nativeEvent.identifier] = object
    }
  }

  const handleTouchMove = (e) => {
    // console.log('Touch move:', e.nativeEvent.identifier);

    if (!active[e.nativeEvent.identifier]) {
      return;
    }

    const object = draggedObjects[e.nativeEvent.identifier]
    
    if (object != null) {
      // console.log('Dragging...');
      const touch = new Vector2(
        (e.nativeEvent.locationX / screenWidth) * 2 - 1,
        - (e.nativeEvent.locationY / screenHeight) * 2 + 1
      );

      const raycaster = new Raycaster();
      raycaster.setFromCamera(touch, camera);

      var plane = new Plane(new Vector3(0, 0, 1), - object.original.z);

      var intersects = new THREE.Vector3();
      
      object.position.y = Math.max(blockHeight / -2, raycaster.ray.intersectPlane(plane, intersects).y);
      
    } else {
      // console.log('No intersecting object')
    }
  }

  const handleTouchEnd = (e) => {
    console.log('Touch end:', e.nativeEvent.identifier);
    active[e.nativeEvent.identifier] = false;
    if (e.nativeEvent.touches.length == 0) {
      maxDrag = 0;
    }
    const object = draggedObjects[e.nativeEvent.identifier];
    if (object != null) {
      var height = object.position.y + blockHeight / 2;
      var time = Math.sqrt(2 * height / gravity);
      const details = {
        object: object,
        height: height,
        time: time,
        radius: 0,
      }
      object.timeline.to(
        object.position,
        time,
        {
          y: blockHeight / -2,
          ease: Quad.easeIn,
          onComplete: () => {
            quake(details);
          }
        }
      )
  
      object.falling = true;
      draggedObjects[e.nativeEvent.identifier] = null;
    }
  }

  const quake = (details) => {
    details.object.timeline = new gsap.timeline();
    details.object.falling = false;
    quakes.push(details);
  }

  const onContextCreate = async (gl) => {
    // Dimensions of view
    const viewWidth = 30;
    const viewHeight = viewWidth * (gl.drawingBufferHeight / gl.drawingBufferWidth);

    var cols = Math.ceil(viewWidth * Math.SQRT1_2) - 6;
    var rows = Math.ceil(viewHeight * Math.SQRT1_2) - 3;

    // Create camera
    camera = new OrthographicCamera(viewWidth / -2, viewWidth / 2, viewHeight / 2, viewHeight / -2, 1, 1000);
    camera.position.set(0, 50, 100);
    camera.lookAt(0, 0, 0);

    // Create renderer
    const renderer = new Renderer({ gl });
    renderer.setClearColor(background);
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);

    // Create scene
    scene = new Scene();

    // Create lights
    var directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 0);
    scene.add(directionalLight);

    var ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);

    // Create geometry and material for objects
    var geometry = new THREE.BoxGeometry(3, blockHeight, 1);
    var material = new THREE.MeshLambertMaterial({ color: 0xffffff });

    // Draw meshes
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        var mesh = new THREE.Mesh(geometry, material);
        if ((i + j) % 2 == 0) {
          mesh.position.set(
            (i - cols / 2 + 0.5) * Math.sqrt(2),
            blockHeight / -2,
            (j - rows / 2 + 0.5) * 2 * Math.sqrt(2)
          );
          if (i % 2 == 0) {
            mesh.rotation.set(0, Math.PI / 4, 0);
          } else {
            mesh.rotation.set(0, Math.PI / -4, 0);
          }

          mesh.original = {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,              
          }
          mesh.timeline = new gsap.timeline();
          
          scene.add(mesh);
          objects.push(mesh);
        }
      }
    }

    // Setup an animation loop
    const render = () => {
      timeout = requestAnimationFrame(render);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
  };

  return (
    <GLView 
      style={{ flex: 1 }} 
      onContextCreate={onContextCreate} 
      onTouchStart={handleTouchStart} 
      onTouchEnd={handleTouchEnd} 
      onTouchMove={handleTouchMove}
      onLayout={(e) => {
        screenWidth = e.nativeEvent.layout.width;
        screenHeight = e.nativeEvent.layout.height;
      }}
    />
  );
}