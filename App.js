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
  GridHelper,
  AxesHelper,
  Plane,
  Vector3
} from "three";

export default function App() {
  let timeout;
  const appState = React.useRef(AppState.currentState);
  const [refresh, setRefresh] = React.useState('');

  React.useEffect(() => {
    AppState.addEventListener("change", nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        console.log("App has come to the foreground!");
      } else {
        setRefresh('');
      }
    });

    // Clear the animation loop when the component unmounts
    return () => {
      clearTimeout(timeout);
    }
  }, []);

  const objects = []
  var object;
  var scene;
  var camera;
  var screen_width;
  var screen_height;
  const raycaster = new Raycaster();
  const touch = new Vector2();
  var touches = 0;

  // User adjustable variables
  var gravity = 5;
  var wavespeed = 20;
  var max_height = 3;
  var time_param = 0.3;
  var background = 0xffd1dc;
  const block_height = 3;

  const distance = (pointOne, pointTwo) => {
    const dist = Math.sqrt((pointOne.x - pointTwo.x) ** 2 + (pointOne.z - pointTwo.z) ** 2);
    return dist;
  }

  const handleTouchStart = (e) => {
    console.log('Touch start:', e.nativeEvent.identifier);
    if (touches == 0) {

      touch.x = (e.nativeEvent.locationX / screen_width) * 2 - 1;
      touch.y = - (e.nativeEvent.locationY / screen_height) * 2 + 1;

      raycaster.setFromCamera(touch, camera);

      var intersects = raycaster.intersectObjects(objects, false)
      
      if (intersects.length > 0) {
        object = intersects[0].object;
        if (object.falling) {
          object.timeline.clear();
        }
        touches += 1;
        object.drag = true;
      }
    }
  }

  const handleTouchMove = (e) => {
    if (object != null && e.nativeEvent.identifier == 0) {
      // console.log('Dragging...');
      touch.x = (e.nativeEvent.locationX / screen_width) * 2 - 1;
      touch.y = - (e.nativeEvent.locationY / screen_height) * 2 + 1;

      raycaster.setFromCamera(touch, camera);

      var plane = new Plane(new Vector3(0, 0, 1), - object.original.z);

      var intersects = new THREE.Vector3();
      
      object.position.y = raycaster.ray.intersectPlane(plane, intersects).y;
      
    } else {
      // console.log('No intersecting object')
    }
  }

  const handleTouchEnd = (e) => {
    console.log('Touch end:', e.nativeEvent.identifier);
    if (object != null && e.nativeEvent.identifier == 0) {
      var height = object.position.y + block_height / 2;
      var time = Math.sqrt(2 * height / gravity);
      const details = {
        object: object,
        height: height,
        time: time_param
      }
      object.timeline.to(
        object.position,
        time,
        {
          y: block_height / -2,
          ease: Quad.easeIn,
          onComplete: () => quake(details)
        }
      )

  
      touches -= 1;
      object.drag = false;
      object.falling = true;
      object = null;
    }
  }

  const quake = (details) => {
    for (var i = 0; i < objects.length; i++) {
      if (objects[i] === details.object) {
        continue;
      }
      if (objects[i].drag || objects[i].falling) {
        continue;
      }
      var start_time = distance(
        details.object.position, 
        objects[i].position
        ) / wavespeed;
      objects[i].timeline.to(
        objects[i].position,
        details.time,
        {
          y: (max_height >= 0 ? Math.min(max_height, details.height) : details.height) - block_height / 2,
          ease: Quad.easeOut
        },
        start_time
      );
      objects[i].timeline.to(
        objects[i].position,
        details.time,
        {
          y: block_height / -2,
          ease: Quad.easeIn,
          onComplete: (i) => {
            objects[i].timeline = new gsap.timeline();
          },
          onCompleteParams: [i]
        },
        start_time + details.time
      );
    }

    details.object.timeline = new gsap.timeline();
    details.object.falling = false;
  }

  const onContextCreate = async (gl) => {
    // console.log(gl.drawingBufferWidth, gl.drawingBufferHeight);
    // console.log(screen_width, screen_height);

    // screen_height = gl.drawingBufferHeight;
    // screen_width = gl.drawingBufferWidth;

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
    var geometry = new THREE.BoxGeometry(3, block_height, 1);
    var material = new THREE.MeshLambertMaterial({ color: 0xffffff });

    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        var mesh = new THREE.Mesh(geometry, material);
        if ((i + j) % 2 == 0) {
          mesh.position.set(
            (i - cols / 2 + 0.5) * Math.sqrt(2),
            block_height / -2,
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
