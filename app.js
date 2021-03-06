var shaderProgram;
var canvas;
var gl;
var glMatrix;

// Texture and framebuffer
var rttFramebuffer;
var rttTexture;

var modelVertexPositionBuffer;
var modelVertexTextureCoordBuffer;

var mvMatrixStack = [];
var mvMatrix = glMatrix.mat4.create();
var pMatrix = glMatrix.mat4.create();

var texturesLoaded = 0;
var numberOfTextures = 2;

var currentlyPressedKeys = {};

var guardTexture;
var worldTexture;

var guardVertexNormalBuffer;
var guardVertexTextureCoordBuffer;
var guardVertexPositionBuffer;
var guardVertexIndexBuffer;

var worldVertexNormalBuffer;
var worldVertexTextureCoordBuffer;
var worldVertexPositionBuffer;
var worldVertexIndexBuffer;

var guardRotate = 0;

var numGuards = 5;
var Guards = [];

var gameOver = false;
var startTime;
var endTime;

var bulletPositionBuffer;
var drawBullet = false;
var bulletX;
var bulletY;
var bulletZ;
var bulletAngle;

var currentlyPressedKeys = {};

// Variables for storing current position and speed
var pitch = 0;
var pitchRate = 0;
var yaw = 90;
var yawRate = 0;
var xPosition = 10;
var yPosition = 0.4;
var zPosition = 0;
var speed = 0;

// Used to make us "jog" up and down as we move forward.
var joggingAngle = 0;

// Helper variable for animation
var lastTime = 0;

function mvPushMatrix() {
    var copy = glMatrix.mat4.create();
    glMatrix.mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}
  
function mvPopMatrix() {
    if (mvMatrixStack.length === 0) {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}
  
function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

class Guard {
    constructor(vertexBufferGuard, textureBufferGuard, indexBufferGuard, x, y){
        this.vertexBufferGuard = vertexBufferGuard;
        this.textureBufferGuard = textureBufferGuard;
        this.indexBufferGuard = indexBufferGuard;
        this.xlocation = x;
        this.ylocation = y;
        this.shot = false;
    }
}

function setMatrixUniforms() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

function initGL (canvas) {
    var gl = null;
    
    try{
        gl = canvas.getContext('webgl');
        if (!gl) {
            console.log('WebGL not supported, falling back on experimental-webgl');
            gl = canvas.getContext('experimental-webgl');
        }
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
        
    } catch(e) {}

    if (!gl){
        alert("shit browser fam");
    }
    return gl;
} 

function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    
    if (!shaderScript) {
        return null;
    }

    var shaderSource = "";
    var currentChild = shaderScript.firstChild;

    while(currentChild) {
        if (currentChild.nodeType === 3){
            shaderSource += currentChild.textContent;
        }
        currentChild = currentChild.nextSibling;
    }

    var shader;
    if (shaderScript.type === "x-shader/x-fragment"){
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type === "x-shader/x-vertex"){
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert("Error compiling shader: ", gl.getShaderInfoLog(shader));
        return null;
    }
    
    return shader;
}

function initShaders() {
    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");
    
    // Create the shader program
    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    
    // If creating the shader program failed, alert
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert("Unable to initialize the shader program.");
    }
    
    // start using shading program for rendering
    gl.useProgram(shaderProgram);
    
    // store location of aVertexPosition variable defined in shader
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    
    // turn on vertex position attribute at specified position
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
  
    // store location of aTextureCoord variable defined in shader
    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
  
    // turn on vertex texture coordinates attribute at specified position
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);
  
    // store location of uPMatrix variable defined in shader - projection matrix 
    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    // store location of uMVMatrix variable defined in shader - model-view matrix 
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  
    // store location of uSampler variable defined in shader
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
}

function initTextures() {
    guardTexture = gl.createTexture();
    guardTexture.image = new Image();
    guardTexture.image.onload = function() {
        handleTextureLoaded(guardTexture);
    };
    guardTexture.image.src = "./assets/guard.png";

    worldTexture = gl.createTexture();
    worldTexture.image = new Image();
    worldTexture.image.onload = function() {
        handleTextureLoaded(worldTexture);
    };
    worldTexture.image.src = "./assets/world.png";
}

function handleTextureLoaded(texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    
    texturesLoaded += 1;
}

function initTextureFramebuffer() {
    rttFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, rttFramebuffer);
    rttFramebuffer.width = 512;
    rttFramebuffer.height = 512;
  
    rttTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, rttTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
  
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, rttFramebuffer.width, rttFramebuffer.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  
    var renderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, rttFramebuffer.width, rttFramebuffer.height);
  
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rttTexture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
  
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function handleLoadedGuard(guardData) {
    // dobis iz json fila posamezne atribute 
    var guardVertices = guardData.meshes[0].vertices;
    var guardIndices = [].concat.apply([], guardData.meshes[0].faces);
    var guardTexCoords = guardData.meshes[0].texturecoords[0];
    
    // v buffer posles teksturne koordinate
    guardVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, guardVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(guardTexCoords), gl.STATIC_DRAW);
    // pomozne spremenljivke za kasneje
    guardVertexTextureCoordBuffer.itemSize = 2;
    guardVertexTextureCoordBuffer.numItems = guardTexCoords.length / 2;
  
    // v buffer posles vertexe
    guardVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, guardVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(guardVertices), gl.STATIC_DRAW);
    // pomozne spremenljivke za kasneje
    guardVertexPositionBuffer.itemSize = 3;
    guardVertexPositionBuffer.numItems = guardVertices.length / 3;
  
    // v buffer posles indice
    guardVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, guardVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(guardIndices), gl.STATIC_DRAW);
    // pomozne spremenljivke za kasneje
    guardVertexIndexBuffer.numItems = guardIndices.length;
    
    Guards.push(new Guard(guardVertexPositionBuffer, guardVertexTextureCoordBuffer, guardVertexIndexBuffer, 0, -7));
    Guards.push(new Guard(guardVertexPositionBuffer, guardVertexTextureCoordBuffer, guardVertexIndexBuffer, -6, 3.5));
    Guards.push(new Guard(guardVertexPositionBuffer, guardVertexTextureCoordBuffer, guardVertexIndexBuffer, 0, 9));
    Guards.push(new Guard(guardVertexPositionBuffer, guardVertexTextureCoordBuffer, guardVertexIndexBuffer, 6, 0));
    Guards.push(new Guard(guardVertexPositionBuffer, guardVertexTextureCoordBuffer, guardVertexIndexBuffer, 3.5, -13));
    
    console.log(Guards);
}

function handleLoadedWorld(worldData) {
    var worldVertices = worldData.meshes[0].vertices;
    var worldIndices = [].concat.apply([], worldData.meshes[0].faces);
    var worldTexCoords = worldData.meshes[0].texturecoords[0];
    
    worldVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(worldTexCoords), gl.STATIC_DRAW);
    worldVertexTextureCoordBuffer.itemSize = 2;
    worldVertexTextureCoordBuffer.numItems = worldTexCoords.length / 2;
  
    // Pass the vertex positions into WebGL
    worldVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(worldVertices), gl.STATIC_DRAW);
    worldVertexPositionBuffer.itemSize = 3;
    worldVertexPositionBuffer.numItems = worldVertices.length / 3;
  
    // Pass the indices into WebGL
    worldVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, worldVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(worldIndices), gl.STATIC_DRAW);
    worldVertexIndexBuffer.numItems = worldIndices.length;
}

function loadGuard() {
    var request = new XMLHttpRequest();
    request.open("GET", "./assets/guard.json");
    request.onreadystatechange = function () {
      if (request.readyState === 4) {
        handleLoadedGuard(JSON.parse(request.responseText));
      }
    };
    request.send();
}

function loadWorld() {
    var request = new XMLHttpRequest();
    request.open("GET", "./assets/world.json");
    request.onreadystatechange = function () {
      if (request.readyState === 4) {
        handleLoadedWorld(JSON.parse(request.responseText));
      }
    };
    request.send();
}

function setMatrixUniform() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

function animate() {
    var timeNow = new Date().getTime();
    if (lastTime !== 0) {
        var elapsed = timeNow - lastTime;
  
        if (speed !== 0) {
            xPosition -= Math.sin(degToRad(yaw)) * speed * elapsed;
            zPosition -= Math.cos(degToRad(yaw)) * speed * elapsed;

            joggingAngle += elapsed * 0.6; // 0.6 "fiddle factor" - makes it feel more realistic :-)
            yPosition = Math.sin(degToRad(joggingAngle)) / 20 + 0.4;
        }

        yaw = (yaw + yawRate * elapsed + 360) % 360;
        pitch += pitchRate * elapsed;
  
        guardRotate += 0.1;
    }
    lastTime = timeNow;
}

function handleKeyDown(event) {
    // storing the pressed state for individual key
    //console.log("pressing");
    currentlyPressedKeys[event.keyCode] = true;
    
}

function handleKeyUp(event) {
    // reseting the pressed state for individual key
    currentlyPressedKeys[event.keyCode] = false;
}

function handleKeys() {
    if (currentlyPressedKeys[33]) {
      // Page Up
      pitchRate = 0.1;
    } else if (currentlyPressedKeys[34]) {
      // Page Down
      pitchRate = -0.1;
    } else {
      pitchRate = 0;
    }
  
    if (currentlyPressedKeys[37] || currentlyPressedKeys[65]) {
      // Left cursor key or A

      yawRate = 0.1;
    } else if (currentlyPressedKeys[39] || currentlyPressedKeys[68]) {
      // Right cursor key or D
      yawRate = -0.1;
    } else {
      yawRate = 0;
    }
  
    if (currentlyPressedKeys[38] || currentlyPressedKeys[87]) {
      // Up cursor key or W
      speed = 0.003;
    } else if (currentlyPressedKeys[40] || currentlyPressedKeys[83]) {
      // Down cursor key
      speed = -0.003;
    } else {
      speed = 0;
    }
    
    if (currentlyPressedKeys[32]) {
      // Space
      drawBullet = true;
      bulletX = xPosition;
      bulletY = yPosition;
      bulletZ = zPosition;
      bulletAngle = yaw;
      console.log("player", xPosition, yPosition, zPosition, bulletAngle);
      console.log("bullet", bulletX, bulletY, bulletZ, bulletAngle);
      /*setTimeout(function() {
          drawBullet = false;
      }, 2000);*/
    }
}

function bulletBuffer() {
  bulletPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bulletPositionBuffer);
  var vertices = [
     0.0,  1.0,  0.0,
    -1.0, -1.0,  0.0,
     1.0, -1.0,  0.0
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  bulletPositionBuffer.itemSize = 3;
  bulletPositionBuffer.numItems = 3;
}

function displayBullet() {
    glMatrix.mat4.translate(mvMatrix, mvMatrix, [bulletX-4, bulletY-0.2, bulletZ+7.2]);
    glMatrix.mat4.scale(mvMatrix, mvMatrix, [0.1, 0.1, 0.1]);
    glMatrix.mat4.rotate(mvMatrix, mvMatrix, degToRad(bulletAngle), [0.0, 1.0, 0.0]);
    gl.bindBuffer(gl.ARRAY_BUFFER, bulletPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, bulletPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
    setMatrixUniforms();
    gl.drawArrays(gl.TRIANGLES, 0, bulletPositionBuffer.numItems);
}

Guard.prototype.draw = function (i) {
    mvPushMatrix();
    drawGuard(i);
};

function drawGuard(i) {
    if (!Guards[i].shot) {

        glMatrix.mat4.translate(mvMatrix, mvMatrix, [Guards[i].xlocation, 0.0, Guards[i].ylocation]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, guardTexture);
        gl.uniform1i(shaderProgram.samplerUniform, 0);

        // Set the texture coordinates attribute for the vertices.
        gl.bindBuffer(gl.ARRAY_BUFFER, guardVertexTextureCoordBuffer);
        gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, guardVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

        // Draw the guard by binding the array buffer to the guard's vertices
        // array, setting attributes, and pushing it to GL.
        gl.bindBuffer(gl.ARRAY_BUFFER, guardVertexPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, guardVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, guardVertexIndexBuffer);
        setMatrixUniforms();
        gl.drawElements(gl.TRIANGLES, guardVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    }
}

function drawWorld() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, worldTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);

    // Set the texture coordinates attribute for the vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, worldVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    // Draw the world by binding the array buffer to the world's vertices
    // array, setting attributes, and pushing it to GL.
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, worldVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, worldVertexIndexBuffer);
    setMatrixUniforms();
    gl.drawElements(gl.TRIANGLES, worldVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}

function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (guardVertexPositionBuffer === null || guardVertexTextureCoordBuffer === null || guardVertexIndexBuffer === null) {
        console.log("guard not loaded");
        return;
    }
    if (worldVertexPositionBuffer === null || worldVertexTextureCoordBuffer === null || worldVertexIndexBuffer === null) {
        console.log("world not loaded");
        return;
    }

    glMatrix.mat4.perspective(pMatrix, degToRad(45), gl.viewportWidth / gl.viewportHeight, 0.1, 1000.0);
    glMatrix.mat4.identity(mvMatrix);
    glMatrix.mat4.rotate(mvMatrix, mvMatrix, degToRad(-pitch), [1, 0, 0]);
    glMatrix.mat4.rotate(mvMatrix, mvMatrix, degToRad(-yaw), [0, 1, 0]);
    glMatrix.mat4.translate(mvMatrix, mvMatrix, [-xPosition, -yPosition, -zPosition]);
    
    drawWorld();
    
    var dead = 0;
    for (var i = 0; i < numGuards; i++) {
        if (Guards[i].shot) {
            dead++;
        }
    }
    
    document.getElementById("guardCounter").innerHTML = numGuards - dead;
    //console.log(numGuards-dead, "guards left");
    
    if (dead === numGuards) {
        endTime = new Date();
        var timeDiff = Math.round((endTime - startTime) / 1000);
        alert("CONGRATULATIONS! \nYou won in " + timeDiff + " seconds.");
        console.log("YOU WIN!");
        gameOver = true;
    }
    
    for (var i = 0; i < numGuards; i++) {
        
        if (!Guards[i].shot) {
            drawGuard(i);
            if (Math.abs(bulletX-Guards[i].xlocation) < 1.5 && Math.abs(bulletZ-Guards[i].ylocation) < 1.5) {
                Guards[i].shot = true;
                //console.log("guard killed");
                //console.log(Guards);
            }
            
            // ce prides preblizu guarda se igra konca
            /*if (!gameOver) {
                if (Math.abs(xPosition-Guards[i].xlocation) < 3 && Math.abs( zPosition-Guards[i].ylocation) < 3) {
                    endTime = new Date();
                    var timeDiff = Math.round((endTime - startTime) / 1000);
                    //alert("GAME OVER! \nYou lasted " + timeDiff + " seconds.");
                    console.log("GAME OVER");
                    //gameOver = true;
                }
            }*/
        }
    }
    
    if (drawBullet){
        displayBullet();
        bulletX -= Math.sin(degToRad(bulletAngle)) * 0.2;
        bulletZ -= Math.cos(degToRad(bulletAngle)) * 0.2;
        //console.log("bullet", bulletX, bulletZ, bulletAngle);
    }
}

var start = function() {
    console.log("started");
    canvas = document.getElementById('game-surface');

    gl = initGL(canvas);

    if (gl){
        gl.clearColor(0.2, 0.3, 0.3, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        initTextureFramebuffer();

        initShaders();
        initTextures();
        loadGuard();
        bulletBuffer();
        
        loadWorld();
        
        startTime = new Date();

        document.onkeydown = handleKeyDown;
        document.onkeyup = handleKeyUp;

        setInterval(function() {
            if (texturesLoaded === numberOfTextures && !gameOver) { // only draw scene and animate when textures are loaded.
                requestAnimationFrame(animate);
                handleKeys();
                drawScene();
                //console.log(xPosition, yPosition, zPosition, yaw);
            }
        }, 15);
    }
};