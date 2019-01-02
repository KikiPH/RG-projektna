var shaderProgram;
var canvas;
var gl;


var modelVertexPositionBuffer;
var modelVertexTextureCoordBuffer;

var mvMatrixStack = [];
var mvMatrix = glMatrix.mat4.create();
var pMatrix = glMatrix.mat4.create();

var texturesLoaded = 0;
var numberOfTextures = 1;

var currentlyPressedKeys = {};

var guardTexture;
var worldTexture;

var guardVertexNormalBuffer;
var guardVertexTextureCoordBuffer;
var guardVertexPositionBuffer;
var guardVertexIndexBuffer;

//animation helper variables
var lastTime = 0;
var effectiveFPMS = 60 / 1000;

function Guard(location){
    this.shot = false;

    //tu nardis funkcijo za padanje (neka rotacija al neki),...
}


var importModels = ["gun", "world", "guard"];


function setMatrixUniforms() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

function initGL (canvas){
    var gl = null;
    
    try{
        gl = canvas.getContext('webgl');
        if (!gl) {
            console.log('WebGL not supported, falling back on experimental-webgl');
            gl = canvas.getContext('experimental-webgl');
        }

        
    } catch(e) {}

    if (!gl){
        alert("shit browser fam");
    }
	return gl;
} 

function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    
    if(!shaderScript){
        return null;
    }

    var shaderSource = "";
    var currentChild = shaderScript.firstChild;

    while(currentChild){
        if (currentChild.nodeType == 3){
            shaderSource += currentChild.textContent;
        }
        currentChild = currentChild.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment"){
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex"){
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


function mvPushMatrix() {
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
  }
  
  function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
  }
  
  function degToRad(degrees) {
    return degrees * Math.PI / 180;
  }

function handleLoadedGuard(guardData){
    
    var guardVertices = guardData.meshes[0].vertices;
    var guardIndices = [].concat.apply([], guardData.meshes[0].faces);
    var guardTexCoords = guardData.meshes[0].texturecoords[0];
    var guardNormals = guardData.meshes[0].normals;
    
    guardVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, guardVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(guardTexCoords), gl.STATIC_DRAW);
    
  
    // Pass the vertex positions into WebGL
    guardVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, guardVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(guardVertices), gl.STATIC_DRAW);
    
  
    // Pass the indices into WebGL
    guardVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, guardVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(guardIndices), gl.STATIC_DRAW);
    
}

function loadGuard() {
    var request = new XMLHttpRequest();
    request.open("GET", "./assets/guard.json");
    request.onreadystatechange = function () {
      if (request.readyState == 4) {
        handleLoadedGuard(JSON.parse(request.responseText));
      }
    }
    request.send();
}

function initGuard(){

}
  

function initTextures() {
    guardTexture = gl.createTexture();
    guardTexture.image = new Image();
    guardTexture.image.onload = function() {
        handleTextureLoaded(guardTexture);
    }
    guardTexture.image.src = "./assets/guard.png";
}

function handleTextureLoaded(texture){
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    
    texturesLoaded += 1;
}

function initWorldObjects() {
    
}

function setMatrixUniform(){
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}


function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    // Clear the canvas before we start drawing on it.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //console.log(guardVertexIndexBuffer);
    
    
    //console.log(guardVertexPositionBuffer);


    if (guardVertexPositionBuffer == null || guardVertexTextureCoordBuffer == null || guardVertexIndexBuffer == null) {
      return;
    }
    
    glMatrix.mat4.perspective(pMatrix, degToRad(45), gl.viewportWidth / gl.viewportHeight, 0.1, 1000.0);

    //glMatrix.mat4.prespective

    // Set the drawing position to the "identity" point, which is
    // the center of the scene.
    glMatrix.mat4.identity(mvMatrix);

    // Now move the drawing position a bit to where we want to start
    // drawing the cube.
    glMatrix.mat4.translate(mvMatrix, mvMatrix, [0.0, 0.0, -7.0]);

   
    
    // Draw the guard by binding the array buffer to the guard's vertices
    // array, setting attributes, and pushing it to GL.
    gl.bindBuffer(gl.ARRAY_BUFFER, guardVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, gl.FALSE, 3 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
    // Set the texture coordinates attribute for the vertices.
    gl.bindBuffer(gl.ARRAY_BUFFER, guardVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, 2, gl.FLOAT, gl.FALSE, 3 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);
   


    // Specify the texture to map onto the faces.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, guardTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);

    // Draw the guard.
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, guardVertexIndexBuffer);
    setMatrixUniforms();
    gl.drawElements(gl.TRIANGLES, guardVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
  }





var start = function() {
    console.log("started");
    canvas = document.getElementById('game-surface');

    gl = initGL(canvas);

    if (gl){
        gl.clearColor(0.0, 0.0, 0.0, 1.0);                      // Set clear color to black, fully opaque
        gl.clearDepth(1.0);                                     // Clear everything
        gl.enable(gl.DEPTH_TEST);                               // Enable depth testing
        gl.depthFunc(gl.LEQUAL);  


        initShaders();
        initTextures();
        loadGuard();

        //drawScene();
        setInterval(function() {
            if (texturesLoaded == numberOfTextures) { // only draw scene and animate when textures are loaded.
                drawScene();
            }
        }, 15);
    }
    

    
}
