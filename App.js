"use strict";

import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import * as React from "react";
import { Dimensions } from "react-native";
import {
  Scene,
  OrthographicCamera,
  Vector2,
  Raycaster
} from "three";

export default function App() {
  let timeout;

  React.useEffect(() => {
    // Clear the animation loop when the component unmounts
    return () => clearTimeout(timeout);
  }, []);

  const objects = []
  var object;
  var scene;
  var camera;
  var touch_registered = true;
  var screen_width;
  var screen_height;
  const raycaster = new Raycaster();
  const touch = new Vector2();
  var touches = 0

  const handleTouchStart = (e) => {
    if (touch_registered && touches == 0) {
      console.log('Touch start');
      console.log(screen_width, screen_height);
      touches += 1;

      touch.x = (e.nativeEvent.locationX / screen_width) * 2 - 1;
      touch.y = - (e.nativeEvent.locationY / screen_height) * 2 + 1;

      console.log(touch);
      raycaster.setFromCamera(touch, camera);

      var intersects = raycaster.intersectObjects(objects, true)
      
      if (intersects.length > 0) {
        object = intersects[0].object;
        object.position.y = -49;
        object.drag = true;
      }
    }
  }

  const handleTouchMove = (e) => {
    if (object != null) {
      console.log('Dragging...');
      console.log(e.nativeEvent.locationX);
      console.log(e.nativeEvent.locationY);
    } else {
      console.log('No intersecting object')
    }
  }

  const handleTouchEnd = (e) => {
    console.log('Touch end');
    touches -= 1;
    object = null;
  }

  const onContextCreate = async (gl) => {
    console.log(gl.drawingBufferWidth, gl.drawingBufferHeight);
    console.log(screen_width, screen_height);

    // screen_height = gl.drawingBufferHeight;
    // screen_width = gl.drawingBufferWidth;

    // Dimensions of view
    const viewWidth = 30;
    const viewHeight = viewWidth * (gl.drawingBufferHeight / gl.drawingBufferWidth);

    // User adjustable variables
    var gravity = 5;
    var wavespeed = 20;
    var cols = Math.ceil(viewWidth * Math.SQRT1_2) - 6;
    var rows = Math.ceil(viewHeight * Math.SQRT1_2) - 3;
    var max_height = 3;
    var time_param = 0.3;
    var background = 0xffd1dc;

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
    var geometry = new THREE.BoxGeometry(3, 100, 1);
    var material = new THREE.MeshLambertMaterial({ color: 0xffffff });

    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        var mesh = new THREE.Mesh(geometry, material);
        if ((i + j) % 2 == 0) {
          mesh.position.set(
            (i - cols / 2 + 0.5) * Math.sqrt(2),
            -50,
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
          
          scene.add(mesh);
          objects.push(mesh);
        }
      }
    }

    // const dragControls = new DragControls(objects, camera, renderer.domElement);

    // dragControls.addEventListener('drag', (event) => {
    //   console.log("Hi");
    //   event.object.drag = true;
    //   event.object.position.x = event.object.original.x;
    //   event.object.position.y = event.object.position.y;
    //   event.object.position.z = event.object.original.z;
    // });

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
        screen_width = e.nativeEvent.layout.width;
        screen_height = e.nativeEvent.layout.height;
      }}
    />
  );
}

// class IconMesh extends Mesh {
//   constructor() {
//     super(
//       new BoxBufferGeometry(1.0, 1.0, 1.0),
//       new MeshStandardMaterial({
//         map: new TextureLoader().load(require("./icon.jpg")),
//       })
//     );
//   }
// }
