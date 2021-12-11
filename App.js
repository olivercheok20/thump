"use strict";

import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import * as ScreenOrientation from "expo-screen-orientation";
import * as React from "react";
import { AppState, Button, Modal, ScrollView, Text, TouchableOpacity, Vibration, View } from "react-native";
import { gsap, Quad } from "gsap";
import {
  Scene,
  OrthographicCamera,
  DirectionalLight,
  AmbientLight,
  Raycaster,
  Plane,
  BoxGeometry,
  CylinderGeometry,
  // SphereGeometry,
  // TorusGeometry,
  MeshLambertMaterial,
  Mesh,
  Vector2,
  Vector3
} from "three";
import * as GLOBAL from "./global.js";
import { useFonts, Montserrat_500Medium } from "@expo-google-fonts/montserrat";
import { Slider } from '@miblanchard/react-native-slider';
import ColorPicker from 'react-native-wheel-color-picker';
import RadioButtonRN from 'radio-buttons-react-native';


ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);

export default function App() {
  let timeout;
  let [fontsLoaded] = useFonts({Montserrat_500Medium});
  const appState = React.useRef(AppState.currentState);
  const [screenWidth, setScreenWidth] = React.useState(0);
  const [screenHeight, setScreenHeight] = React.useState(0);
  const [modalOpen, setModalOpen] = React.useState(false);

  var scene;
  var renderer;
  var camera = React.useRef(null);
  var viewWidth = 30;
  var viewHeight;
  var directionalLight;
  var ambientLight;
  var rectGeometry;
  var squareGeometry;
  var cylinderGeometry;
  // var sphereGeometry;
  // var torusGeometry;
  var material;

  var gl = React.useRef(null);

  var cols;
  var rows;

  // Initialise data structures for animation
  var objects = React.useRef([]);
  var touches = {};
  var draggedObjects = {};
  var active = {};
  var maxDrag = 0;
  var quakes = React.useRef([]);
  var offset = 0;

  var contexts = React.useRef(0);

  const [refresh, setRefresh] = React.useState(Math.random());


  React.useEffect(() => {
    AppState.addEventListener("change", nextAppState => {
      Vibration.cancel();
      if (!(
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      )) {
        setRefresh(Math.random());
        if (gl.current != null) {
          (async () => {
            let response = await onContextCreate(gl.current);
          })();
        }
      }
    });

    // Clear the animation loop when the component unmounts
    return () => {
      clearTimeout(timeout);
    }
  }, []);

  const handleBlockTouchStart = (e) => {
    // console.log('Touch start:', e.nativeEvent.identifier);
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
    raycaster.setFromCamera(touch, camera.current);

    var intersects = raycaster.intersectObjects(objects.current, false)
    if (intersects.length > 0) {
      if (GLOBAL.vibration == 1) {
        Vibration.vibrate(15);
      }
      const object = intersects[0].object;
      offset = intersects[0].point.y - GLOBAL.blockHeight / 2 - object.position.y;

      object.timeline.clear()
      object.dragged = true;
      draggedObjects[e.nativeEvent.identifier] = object
    }
  }

  const handleBlockTouchMove = (e) => {
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
      raycaster.setFromCamera(touch, camera.current);

      var plane = new Plane(new Vector3(0, 0, 1), - object.original.z);

      var intersects = new Vector3();
      
      object.position.y = Math.max(GLOBAL.blockHeight / -2, Math.max(GLOBAL.blockHeight / -2, raycaster.ray.intersectPlane(plane, intersects).y) - GLOBAL.blockHeight / 2 - offset);
    } else {
      // console.log('No intersecting object')
    }
  }

  const handleBlockTouchEnd = (e) => {
    // console.log('Touch end:', e.nativeEvent.identifier);
    active[e.nativeEvent.identifier] = false;
    if (e.nativeEvent.touches.length == 0) {
      maxDrag = 0;
    }
    const object = draggedObjects[e.nativeEvent.identifier];
    if (object != null) {
      object.dragged = false;
      var height = object.position.y + GLOBAL.blockHeight / 2;
      var time = Math.sqrt(2 * height / GLOBAL.gravity);
      const details = {
        object: object,
        height: height,
        time: time,
        radius: 0,
        raised: 0
      }
      object.timeline.to(
        object.position,
        time,
        {
          y: GLOBAL.blockHeight / -2,
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
    quakes.current.push(details);
  }

  const distance = (pointOne, pointTwo) => {
    const dist = Math.sqrt((pointOne.x - pointTwo.x) ** 2 + (pointOne.z - pointTwo.z) ** 2);
    return dist;
  }

  const onContextCreate = async (glContext) => {
    if (glContext.drawingBufferHeight == null) {
      return;
    }
    contexts.current += 1;
    const currentContext = contexts.current;

    gl.current = glContext; 

    // Dimensions of view
    viewWidth = 30;
    viewHeight = viewWidth * (gl.current.drawingBufferHeight / gl.current.drawingBufferWidth);

    cols = Math.ceil(viewWidth * Math.SQRT1_2) - 4;
    rows = Math.ceil(3 * (Math.ceil(viewHeight * Math.SQRT1_2) - 3) / 4);

    // Create camera
    camera.current = new OrthographicCamera(viewWidth / -2, viewWidth / 2, viewHeight / 2, viewHeight / -2, 1, 1000);
    camera.current.position.set(0, 50, 100);
    camera.current.lookAt(0, 0, 0);

    // Create renderer
    // console.log(gl.current.drawingBufferHeight);
    renderer = new Renderer({ gl: gl.current });
    // renderer.setClearColor(GLOBAL.background);
    renderer.setClearColor(GLOBAL.background, 0);
    renderer.setSize(gl.current.drawingBufferWidth, gl.current.drawingBufferHeight);

    // Create scene
    scene = new Scene();

    // Create lights
    directionalLight = new DirectionalLight(GLOBAL.directionalColor, GLOBAL.directionalIntensity);
    directionalLight.position.set(10, 20, 0);
    scene.add(directionalLight);

    ambientLight = new AmbientLight(GLOBAL.ambientColor, GLOBAL.ambientIntensity);
    scene.add(ambientLight);

    // Create geometry and material for objects
    rectGeometry = new BoxGeometry(3, GLOBAL.blockHeight, 1);
    squareGeometry = new BoxGeometry(GLOBAL.squareSide, GLOBAL.blockHeight, GLOBAL.squareSide);
    cylinderGeometry = new CylinderGeometry(GLOBAL.circleRadius, GLOBAL.circleRadius, GLOBAL.blockHeight, 32);
    // sphereGeometry = new SphereGeometry(GLOBAL.sphereRadius, 32, 32);
    // torusGeometry = new TorusGeometry(GLOBAL.torusRadius, GLOBAL.torusTube, 32, 32);
    material = new MeshLambertMaterial({ color: GLOBAL.blockColor });

    // Initialise data structures for animation
    touches = {};
    draggedObjects = {};
    active = {};
    maxDrag = 0;
    quakes.current = [];
    objects.current = [];
    
    // Draw meshes
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        switch (GLOBAL.shape) {
          case GLOBAL.RECTANGLE:
            var mesh = new Mesh(rectGeometry, material);
            break;
          case GLOBAL.SQUARE:
            var mesh = new Mesh(squareGeometry, material);
            break;
          case GLOBAL.CIRCLE:
            var mesh = new Mesh(cylinderGeometry, material);
            break;
          // case GLOBAL.SPHERE:
          //   var mesh = new Mesh(sphereGeometry, material);
          //   break;
          // case GLOBAL.TORUS:
          //   var mesh = new Mesh(torusGeometry, material);
          //   break;
        }

        if ((i + j) % 2 == 0) {
          mesh.position.set(
            (i - cols / 2 + 0.5) * Math.sqrt(2),
            GLOBAL.blockHeight / -2,
            (j - rows / 3) * 2 * Math.sqrt(2)
          );
          if (GLOBAL.shape == GLOBAL.RECTANGLE || GLOBAL.shape == GLOBAL.SQUARE) {
            if (i % 2 == 0) {
              mesh.rotation.set(0, Math.PI / 4, 0);
            } else {
              mesh.rotation.set(0, Math.PI / -4, 0);
            }
          } 
          // else if (GLOBAL.shape == GLOBAL.TORUS) {
          //   mesh.rotation.set(Math.PI / 2, 0, 0);
          // }

          mesh.original = {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,              
          }
          mesh.timeline = new gsap.timeline();
          mesh.velocity = 0;
          
          scene.add(mesh);
          objects.current.push(mesh);
        }
      }
    }

    // Setup an animation loop
    const render = () => {
      if (currentContext != contexts.current) {
        return;
      }
      timeout = requestAnimationFrame(render);
      renderer.render(scene, camera.current);
      const quakes_to_delete = [];
      if (GLOBAL.vibration == 1) {
        if (quakes.current.length > 0) {
          Vibration.vibrate([0, 50, 0], true);
        } else {
          Vibration.cancel();
        }
      }

      for (var i = 0; i < quakes.current.length; i++) {
        const quake = quakes.current[i];
        for (var j = 0; j < objects.current.length; j++) {
          if (objects.current[j] === quake.object) {
            continue;
          }
          const dist_from_source = distance(quake.object.position, objects.current[j].position);
          if (dist_from_source >= quake.radius && dist_from_source < quake.radius + GLOBAL.wavespeed / GLOBAL.timeScale) {
            var velocity_add = Math.sqrt(2 * GLOBAL.gravity * quake.height);
            if (GLOBAL != null && GLOBAL.minVelocity != -1) {
              velocity_add = Math.max(velocity_add, GLOBAL.minVelocity);
            }
            objects.current[j].velocity += velocity_add;
            quake.raised += 1;
            if (quake.raised == rows * cols / 2 - 1) {
              quakes_to_delete.push(i);
            }
          }
        }
        quake.radius += GLOBAL.wavespeed / GLOBAL.timeScale;
      }

      for (var j = 0; j < objects.current.length; j++) {
        if (objects.current[j].falling || objects.current[j].dragged) {
          continue;
        }
        objects.current[j].position.y += objects.current[j].velocity / GLOBAL.timeScale; // scale this by time
        objects.current[j].velocity -= GLOBAL.gravity / GLOBAL.timeScale;
        if (GLOBAL != null && GLOBAL.maxVelocity != -1) {
        objects.current[j].velocity = Math.min(objects.current[j].velocity, GLOBAL.maxVelocity);
        }
        if (objects.current[j].position.y <= GLOBAL.blockHeight / -2) {
          objects.current[j].position.y = GLOBAL.blockHeight / -2;
          objects.current[j].velocity = 0;
        }
      }

      for (var i = quakes_to_delete.length - 1; i >= 0; i--) {
        quakes.current.splice(quakes_to_delete[i], 1);
      }
      gl.current.endFrameEXP();
    };
    render();
  };

  const hexToRgb = (hex) => {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  const getRelativeLuminance = (rgb) => {
    return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b
  }

  const blackOrWhite = () => {
    return getRelativeLuminance(hexToRgb(GLOBAL.background)) > 150 ? 'black' : 'white'
  }

  const getRandomColor = () => {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  return (
    <View 
      style={{ flex: 1 }}
    >
      <View
        style={{ 
          flex: 1,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: GLOBAL.background,
        }}
      >
      </View>
      <View 
        style={{ 
          flex: 1,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 200,
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          paddingTop: 50
        }}
      >

        {fontsLoaded && <Text 
          style={{
            fontSize: 72,
            fontFamily: 'Montserrat_500Medium',
            color: blackOrWhite()
          }}
        >
          thump
        </Text>}
      </View>
      <GLView 
        style={{ flex: 1 }} 
        onContextCreate={onContextCreate} 
        onTouchStart={handleBlockTouchStart} 
        onTouchEnd={handleBlockTouchEnd} 
        onTouchMove={handleBlockTouchMove}
        onLayout={(e) => {
          setScreenWidth(e.nativeEvent.layout.width);
          setScreenHeight(e.nativeEvent.layout.height);
        }}
      />
      <View 
        style={{ 
          flex: 1,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 200,
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          paddingTop: 50
        }}
        onTouchStart={() => {
          console.log("Opening modal...");
          setModalOpen(true);
          Vibration.cancel();
        }}
      >
      </View>
      <Modal
        animationType={'fade'}
        transparent={true}
        visible={modalOpen}
        statusBarTranslucent={true}
        onRequestClose={() => {
          console.log('Closing modal...');
          setModalOpen(false);
        }}
      >
        <View
          style={{
            flex: 1,
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: GLOBAL.background,
          }}
          onTouchStart={() => {
            console.log('Closing modal...');
            onContextCreate(gl.current);
            setModalOpen(false);
          }}
        >
        </View>

        <View
          style={{
            flex: 1,
            marginTop: 100,
            margin: 20,
            borderRadius: 25,
            backgroundColor: 'rgba(40, 44, 53, 1)',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Text
            style={{
              marginTop: 20,
              color: 'white',
              fontSize: 40,
              fontFamily: 'Montserrat_500Medium',
              alignSelf: 'center'
            }}
          >
            Options
          </Text>
          <View
            style={{
              borderBottomColor: '#b3b3b3',
              width: '80%',
              borderBottomWidth: 1,
              marginTop: 25
            }}
          />
          <ScrollView
            style={{
              // margin: 25,
              width: '90%',
              marginTop: 10,
              marginBottom: 25,
              paddingHorizontal: '5%'
            }}
            contentContainerStyle={{
              justifyContent: 'center',
              alignItems: 'stretch'
            }}
          >
                        <TouchableOpacity
              style={{
                backgroundColor: "#03a9f4",
                justifyContent: "center",
                alignItems: "center",
                paddingVertical: 10,
                borderRadius: 10
              }}
              onPress={() => {
                console.log("Randomize...")
                GLOBAL.gravity = Math.floor(Math.random() * (200 - 1 + 1) + 1);
                GLOBAL.wavespeed = Math.floor(Math.random() * (100 - 5 + 1) + 5);
                GLOBAL.blockHeight = Math.floor(Math.random() * (100 - 1 + 1) + 1);
                GLOBAL.timeScale = Math.floor(Math.random() * (100 - 15 + 1) + 15);
                GLOBAL.maxVelocity = Math.floor(Math.random() * (50 - (-1) + 1) + (-1));
                GLOBAL.ambientIntensity = Math.random();
                GLOBAL.background = getRandomColor();
                GLOBAL.blockColor = getRandomColor();
                GLOBAL.vibration = Math.floor(Math.random() * (2 - 1 + 1) + 1);
                GLOBAL.shape = Math.floor(Math.random() * (3 - 1 + 1) + 1);
                setRefresh(Math.random());
              }
              }
            >
              <Text style={{
                fontFamily: 'Montserrat_500Medium',
                color: "white"
              }}>
                Randomize
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: "#03a9f4",
                justifyContent: "center",
                alignItems: "center",
                paddingVertical: 10,
                borderRadius: 10,
                marginVertical: 10
              }}
              onPress={() => {
                console.log("Restore defaults...")
                GLOBAL.gravity = 60;
                GLOBAL.wavespeed = 20;
                GLOBAL.blockHeight = 2;
                GLOBAL.timeScale = 20;
                GLOBAL.maxVelocity = -1;
                GLOBAL.ambientIntensity = 0.1;
                GLOBAL.background = "#ffd1dc";
                GLOBAL.blockColor = "#ffffff";
                GLOBAL.vibration = 1;
                GLOBAL.shape = 1;
                setRefresh(Math.random());
              }
              }
            >
              <Text style={{
                fontFamily: 'Montserrat_500Medium',
                color: "white"
              }}>
                Restore Defaults
              </Text>
            </TouchableOpacity>
            <Text
              style={{
                color: 'white',
                fontFamily: 'Montserrat_500Medium',
                alignSelf: 'center',
                marginTop: 10
              }}
            >
              Gravity
            </Text>
            <Slider
              style={{
                margin: 10,
                width: '90%'
              }}
              thumbTintColor={'white'}
              trackClickable={false}
              value={GLOBAL.gravity}
              minimumValue={1}
              maximumValue={200}
              onValueChange={(value) => {
                console.log('Changing gravity...')
                GLOBAL.gravity = value;
              }}
            />
            <Text
              style={{
                color: 'white',
                fontFamily: 'Montserrat_500Medium',
                alignSelf: 'center',
                marginTop: 10
              }}
            >
              Wave Speed
            </Text>
            <Slider
              style={{
                margin: 10,
                width: '90%'
              }}
              thumbTintColor={'white'}
              trackClickable={false}
              value={GLOBAL.wavespeed}
              minimumValue={5}
              maximumValue={100}
              onValueChange={(value) => {
                console.log('Changing wavespeed...')
                GLOBAL.wavespeed = value;
              }}
            />
            <Text
              style={{
                color: 'white',
                fontFamily: 'Montserrat_500Medium',
                alignSelf: 'center',
                marginTop: 10
              }}
            >
              Block Height
            </Text>
            <Slider
              style={{
                margin: 10,
                width: '90%'
              }}
              thumbTintColor={'white'}
              trackClickable={false}
              value={GLOBAL.blockHeight}
              minimumValue={1}
              maximumValue={100}
              onValueChange={(value) => {
                console.log('Changing block height...')
                GLOBAL.blockHeight = value;
              }}
            />
            <Text
              style={{
                color: 'white',
                fontFamily: 'Montserrat_500Medium',
                alignSelf: 'center',
                marginTop: 10
              }}
            >
              Time Scale
            </Text>
            <Slider
              style={{
                margin: 10,
                width: '90%'
              }}
              thumbTintColor={'white'}
              trackClickable={false}
              value={GLOBAL.timeScale}
              minimumValue={15}
              maximumValue={100}
              onValueChange={(value) => {
                console.log('Changing timescale...')
                GLOBAL.timeScale = value;
              }}
            />
            <Text
              style={{
                color: 'white',
                fontFamily: 'Montserrat_500Medium',
                alignSelf: 'center',
                marginTop: 10
              }}
            >
              Max Block Speed (set to 0 for no max)
            </Text>
            <Slider
              style={{
                margin: 10,
                width: '90%'
              }}
              thumbTintColor={'white'}
              trackClickable={false}
              value={GLOBAL.maxVelocity}
              minimumValue={-1}
              maximumValue={50}
              onValueChange={(value) => {
                console.log('Changing max velocity...')
                GLOBAL.maxVelocity = value;
              }}
            />
            <Text
              style={{
                color: 'white',
                fontFamily: 'Montserrat_500Medium',
                alignSelf: 'center',
                marginTop: 10
              }}
            >
              Light Intensity
            </Text>
            <Slider
              style={{
                margin: 10,
                width: '90%'
              }}
              thumbTintColor={'white'}
              trackClickable={false}
              value={GLOBAL.ambientIntensity}
              minimumValue={0}
              maximumValue={1}
              onValueChange={(value) => {
                console.log('Changing ambient intensity...')
                GLOBAL.ambientIntensity = value;
              }}
            />
            <Text
              style={{
                color: 'white',
                fontFamily: 'Montserrat_500Medium',
                alignSelf: 'center',
                marginTop: 10
              }}
            >
              Background Color
            </Text>
            <ColorPicker
              style={{
                marginBottom: 20,
              }}
              swatches={false}
              color={GLOBAL.background}
              onColorChangeComplete={(value) => {
                console.log('Changing background...');
                GLOBAL.background = value;
                setRefresh(Math.random());
              }}
            />
            <Text
              style={{
                color: 'white',
                fontFamily: 'Montserrat_500Medium',
                alignSelf: 'center',
                marginTop: 10
              }}
            >
              Block Color
            </Text>
            <ColorPicker
              style={{
                marginBottom: 20,
              }}
              swatches={false}
              color={GLOBAL.blockColor}
              onColorChangeComplete={(value) => {
                console.log('Changing block color...');
                GLOBAL.blockColor = value;
                setRefresh(Math.random());
              }}
            />
            <Text
              style={{
                color: 'white',
                fontFamily: 'Montserrat_500Medium',
                alignSelf: 'center',
                marginTop: 10
              }}
            >
              Vibration
            </Text>
            <RadioButtonRN
              data={
                [
                  {label: 'On', value: 1},
                  {label: 'Off', value: 2},
                ]
              }
              initial={GLOBAL.vibration}
              selectedBtn={(e) => {
                console.log("Changing vibration...")
                GLOBAL.vibration=e.value;
                setRefresh(Math.random());
              }}
              box={false}
              boxActiveBgColor={'#fff'}
              textColor={'white'}
            />
            <Text
              style={{
                color: 'white',
                fontFamily: 'Montserrat_500Medium',
                alignSelf: 'center',
                marginTop: 10
              }}
            >
              Shape
            </Text>
            <RadioButtonRN
              style={{
                marginBottom: 20
              }}
              data={
                [
                  {label: 'Rectangle', value: 1},
                  {label: 'Square', value: 2},
                  {label: 'Circle', value: 3},
                  // {label: 'Sphere', value: 4},
                  // {label: 'Torus', value: 5},
                ]
              }
              initial={GLOBAL.shape}
              selectedBtn={(e) => {
                console.log("Changing shape...")
                GLOBAL.shape=e.value;
                setRefresh(Math.random());
              }}
              box={false}
              boxActiveBgColor={'#fff'}
              textColor={'white'}
            />
          </ScrollView>
        </View>
      </Modal>

    </View>
  );
}