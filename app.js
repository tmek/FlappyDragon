//var inAltspace = !!window.Alt;
var inAltspace = window.hasOwnProperty('altspace');


var scene = new THREE.Scene();
var camera;
var renderer;
var loader = new THREE.AltOBJMTLLoader();
var pi = Math.PI;
var OneThirdPi = pi / 3;
var twoPi = 2 * pi;
var scale = 5;
var users = {};

var basering;
var terrain;
var props;
var dragon;
var clouds = [];
var trees = [];
var idleMessage = "Click the grass to Flappy!"

var modelInfos = [
    'Terrain',
    'BaseRing',
    'FarmHouseAndProps',
    'TreeTrunk',
    'Dragon',
    'Cloud',
];
var loadsPending;
var models = {};
var cloudspeed = -.05;
var clock;
var time = 0;
var delta = 0;
var fps = 0;
var cursorEvents;
var gamemode = "idle";
var score = 0;

var isDead = false;
var dragonspeed = 2 * pi / 10; // in radians per second
var gravity = 9.8 * 9.8 * 4;
var upVelocity = 0;
var jumpVelocity = gravity / 4;
var dragonHeight = 12;
var treeGap = dragonHeight * 2.5;
var treeScale = 1.0;
var treeBase = 20;
var postsTraveled = 0;
var lastPostsTraveled = 0;
var lowerTrunkLimit = dragonHeight;
var upperTrunkLimit = dragonHeight * 8;

var hitSound;
var dieSound;
var pointSound;
var swooshingSound;
var wingSound;
var localUser;
var gamestate;
var firebaseSync;

var localDragonAngle = 0;
var localDragonHeight = 0;

var isLocalPlay = false;

// these are used to detect when to play audio events for spectators
var localFlaps = 0;
var lastSyncFlaps = 0;
var lastSyncScore = 0;
var lastSyncStatus = "Game Over!";

var highScoresShown = false;


function logUsers() {
    console.log("logUsers called.");

    console.log(window.innerDepth);

    if ("Alt" in window) {
        Alt.Users.getUsers().then(function (args) {
            console.log(args)
        });
    }
}


function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}


function setLocalUser() {
    localUser = { displayName: "WebUser", isLocal: true, userId: guid() };

    if ("Alt" in window) {
        window.Alt.Users.getLocalUser().then(function (user) {
            localUser = { displayName: user.displayName, isLocal: user.isLocal, userId: user.userId };
            console.log(user);
        });
    }
}

function InitGameState() {

    var firebaseRootUrl = "https://flappy-dragon.firebaseio.com/";
    var appId = "flappy-dragon";

    gamestate = new THREE.Object3D();

    firebaseSync = new FirebaseSync(firebaseRootUrl, appId);
    firebaseSync.addObject(gamestate, "gamestate");

    // gamestate.userData.syncData = {};

    InitGame();
}


function Init() {

    setLocalUser();  

    InitGameState();

}

function InitGame() {
    console.log('localUser: ' + localUser.displayName);

    clock = new THREE.Clock();

    if (inAltspace) {
        //renderer = new THREE.AltRenderer(); // depricated.
        renderer = altspace.getThreeJSRenderer({ version: '0.2.0' });

    }
    else {
        renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);
        var aspect = window.innerWidth / window.innerHeight;
        camera = new THREE.PerspectiveCamera(45, aspect, 1, 2000);
        camera.position.z = 2000; // stand back from origin
        camera.position.y = -100;	// slightly above origin
        camera.lookAt(scene.position);
        // OBJMTLLoader always uses PhongMaterial, so we need light in scene.
        var ambient = new THREE.AmbientLight(0xffffff);
        scene.add(ambient);
    }


    cursorEvents = new CursorEvents();
    cursorEvents.enableMouseEvents(camera);

    loadSounds();
    loadModels();
}


function loadSounds() {
    // Load sound effect. Chromium doesn't support mp3 so include wav too.
    hitSound = new Audio("sounds/sfx_hit.ogg");
    dieSound = new Audio("sounds/sfx_die.ogg");
    pointSound = new Audio("sounds/sfx_point.ogg");
    swooshingSound = new Audio("sounds/sfx_swooshing.ogg");
    wingSound = new Audio("sounds/sfx_wing.ogg");

    hitSound.volume = .5;
    dieSound.volume = .5;
    pointSound.volume = .2;
    swooshingSound.volume = .5;
    wingSound.volume = .5;
}

function loadModels() {
    loadsPending = modelInfos.length;
    for (var i = 0; i < modelInfos.length; i++) {
        addModel(modelInfos[i]);
    }
}


function addModel(modelInfo) {
    var name = modelInfo;
    loader.load("Models/" + name + ".obj", function (object) {

        object.scale.set(1, 1, 1);
        object.position.set(0, 0, 0);
        object.rotation.set(0, 0, 0);

        models[name] = object;
        if (--loadsPending === 0) onModelsLoaded();
    });

}

function updateLowerLogs() {
    for (var i = 0; i < 6; i++) {
        var lower = trees[i].lower;
        var upper = trees[i].upper;
        lower.position.y = upper.position.y - treeGap;
        firebaseSync.saveObject(lower);
    }
}
function updateUpperLogs() {
    for (var i = 0; i < 6; i++) {
        var lower = trees[i].lower;
        var upper = trees[i].upper;
        upper.position.y = lower.position.y + treeGap;
        firebaseSync.saveObject(upper);
    }
}


function onModelsLoaded() {

    scene.scale.set(scale, scale, scale);
    if (inAltspace) {
        if (window.innerDepth === undefined || window.innerDepth < 500) {
            // content browser
            scene.position.set(0, -150, 0);
        }
        else {
            // enclosure
            //var height = -window.innerHeight / 2;
            var height = -400;
            scene.position.set(0, height, 0);
        }
    }
    else {
        // normal 2D web browser
        scene.position.set(0, -400, 600);
    }

    // setup clouds
    for (var i = 0; i < 3; i++) {
        var cloud = models['Cloud'].clone();
        cloud.rotation.y = (2 * pi) * (i / 3);
        //cloud.position.y = 10;
        //cloud.visible = false;
        scene.add(cloud);
        clouds.push(cloud);
    }

    // setup dragon
    dragon = models['Dragon'].clone();
    localDragonHeight = 24;
    scene.add(dragon);

    // setup terrain, base and props
    var hill = new THREE.Object3D();
    terrain = models['Terrain'].clone();
    hill.add(terrain);
    basering = models['BaseRing'].clone();
    hill.add(basering);
    props = models['FarmHouseAndProps'].clone();
    hill.add(props);
    hill.rotation.y = -2 * pi / 4;
    scene.add(hill);

    // setup trees
    var trunk = models['TreeTrunk'];
    trunk.position.y = treeBase;
    trunk.scale.y = treeScale;

    var treeCount = 6;
    for (var i = 0; i < treeCount; i++) {
        var tree = {};
        var lowerTrunk = trunk.clone();
        var upperTrunk = trunk.clone();
        tree.lower = lowerTrunk;
        tree.upper = upperTrunk;
        tree.baseHeight = treeBase;

        lowerTrunk.rotation.y = twoPi / treeCount * i;

        upperTrunk.rotation.y = -twoPi / treeCount * i;
        upperTrunk.position.y += treeGap;
        upperTrunk.rotation.x = pi;  // inver upper trunks


        firebaseSync.addObject(lowerTrunk, "lowerTrunk-" + i);
        firebaseSync.addObject(upperTrunk, "upperTrunk-" + i);


        scene.add(lowerTrunk);
        scene.add(upperTrunk);

        trees.push(tree);
    }
    // tree events
    for (var i = 0; i < 6; i++) {
        var log;
        log = trees[i].lower;
        cursorEvents.addObject(log);
        log.addEventListener("holocursordown", function (event) {
            var newHeight = this.position.y - dragonHeight / 4;
            if (newHeight < lowerTrunkLimit) return;
            this.position.y = newHeight;

            firebaseSync.saveObject(this);
            updateUpperLogs();
        });
        log = trees[i].upper;
        cursorEvents.addObject(log);
        log.addEventListener("holocursordown", function (event) {
            var newHeight = this.position.y + dragonHeight / 4;
            if (newHeight > upperTrunkLimit) return;
            this.position.y = newHeight;

            firebaseSync.saveObject(this);
            updateLowerLogs();
        });
    }

    // add some event listeners
    cursorEvents.addObject(terrain);
    terrain.addEventListener("holocursordown", function (event) {
        handleClick();
    });
    terrain.addEventListener("holocursorup", function (event) {
    });
    //$('body').mousedown(function () {
    //    handleClick();
    //});
    $(window).keypress(function (e) {
        if (e.keyCode == 0 || e.keyCode == 32) {
            handleClick();
        }
    });


    // finalize firebase sync
    firebaseSync.connect(onSyncReady);


}

function onSyncReady() {
    // init and start main game loop    
    onGameIdle();

    animate();
}



function onGameIdle() {
    console.log("idle");
    isDead = false;
    gamemode = "idle";
    upVelocity = 0;
    localDragonHeight = 12 + treeGap / 2;
    $('#status').html(idleMessage);
}

function onGamePlay() {
    startingPostsTraveled = postsTraveled;
    score = 0;
    console.log("play");
    isDead = false;
    gamemode = "play";
    upVelocity = jumpVelocity; // initial flap
    PlayFlapSound();
    //localDragonHeight = 24;
    $('#status').html("Score");
}

function onGameUnlock() {
    gamestate.userData.syncData.status = idleMessage;
    gamestate.userData.syncData.lockedUserId = undefined;
    firebaseSync.saveObject(gamestate);
    isLocalPlay = false;
    onGameIdle();
}

function onGameOver() {

    PlayDeathSounds();

    console.log("over");
    isDead = true;
    gamemode = "over";
    $('#status').html("Game Over!");
    setTimeout(onGameUnlock, 3000);
}



function TryLockGame() {

    if (gamestate.userData.syncData.lockedUserId) {
        // game already locked;
    }
    else {
        gamestate.userData.syncData.lockedUserId = localUser.userId;
        firebaseSync.saveObject(gamestate);
        onGameLocked();
    }
}

function onGameLocked() {
    isLocalPlay = true;
    onGamePlay(); // start a new game
}


function handleClick() {
    switch (gamemode) {
        case "idle":
            TryLockGame();
            break;
        case "play":
            upVelocity = jumpVelocity; // flap
            localFlaps++;
            PlayFlapSound();
            break;
        case "over":
            //onGamePlay(); // retry
            break;
    }
}




function updateClouds() {
    for (var i = 0; i < 3; i++) {
        clouds[i].rotation.y += cloudspeed * delta;
    }

}


function showSyncInfo() {
    var state = gamestate.userData.syncData;
    $("#sync").html('');

    $("#sync").append("isLocalPlay: " + isLocalPlay + "<br/>");

    for (var property in state) {
        $("#sync").append(property + ": " + state[property] + "<br/>");
    }

}


function PlayDeathSounds() {
    if (window.innerDepth === undefined || window.innerDepth < 500) return;

    hitSound.play();

    setTimeout(function () {
        dieSound.play();
    }, 500)
}

function PlayFlapSound() {
    if (window.innerDepth === undefined || window.innerDepth < 500) return;

    wingSound.pause();
    wingSound.currentTime = 0;
    wingSound.play();
}

function PlayScoreSound() {
    if (window.innerDepth === undefined || window.innerDepth < 500) return;

    pointSound.play();
}


function updateHighScores() {

    if (typeof gamestate.userData.syncData.highScores === "undefined") {
        gamestate.userData.syncData.highScores = {};
    }
    var highScores = gamestate.userData.syncData.highScores;

    if (score >= 3) {
        if (typeof highScores[localUser.userId] === "undefined" || highScores[localUser.userId].highScore < score) {
            highScores[localUser.userId] = { userId: localUser.userId, displayName: localUser.displayName, highScore: score };
        }
    }

    displayHighScores();
}

function displayHighScores() {

    if (typeof gamestate.userData.syncData.highScores === "undefined") {
        gamestate.userData.syncData.highScores = {};
    }

    var highScores = gamestate.userData.syncData.highScores;

    // todo: sort everyone's high scores
    var scores = [];
    for (var property in highScores) {
        scores.push(highScores[property]);
    }

    scores.sort(compareScores);

    // print out top 10;
    $('#highscores').html('<h3>High Scores!</h3>');
    for (var i = 0; i < 10; i++) {

        var player = scores[i];
        if (typeof player === "undefined") break;

        $('#highscores').append('<span>' + +player.highScore + " ... " + player.displayName + '</span></br>');
    }

    // gamestate data will be auto saved next animation frame.
}

function compareScores(a, b) {
    if (a.highScore < b.highScore)
        return 1;
    if (a.highScore > b.highScore)
        return -1;
    return 0;
}


function animate() {

    cursorEvents.update();

    delta = clock.getDelta();
    time += delta;
    fps = 1 / delta;

    lastPostsTraveled = postsTraveled;
    postsTraveled = Math.floor(localDragonAngle / OneThirdPi);

    // update dragon's up velocity and position
    if (gamemode == "idle") {
        upVelocity = 0;
    }
    else {
        // calculate score
        if (postsTraveled !== lastPostsTraveled) {
            // crossed a post and still playing so add a point.
            PlayScoreSound();
            score++;
        }

        upVelocity = upVelocity - (gravity * delta);
        localDragonHeight = localDragonHeight + upVelocity * delta;


        // did we crash into ground?
        if (localDragonHeight < 0) {
            localDragonHeight = 0;
            if (gamemode !== "over") onGameOver();
        }

        // did we crash into post?
        //$('#status').html("out");
        var postAngularWidth = .1;  // todo: need to find this true value;
        for (var i = 0; i < trees.length; i++) {
            var postCenter = twoPi / 6 * i;
            var start = postCenter - postAngularWidth;
            var end = postCenter + postAngularWidth;
            var tree = trees[i];
            var drot = localDragonAngle;
            var inside = false;

            if (i === 0) {
                if ((drot >= 0) && (drot < postAngularWidth)) inside = true;
                if ((drot <= twoPi) && (drot > twoPi - postAngularWidth)) inside = true;
            }
            else {
                if ((drot > start) && (drot < end)) inside = true;
            }
            if (inside) {
                // dragon in tree
                if (localDragonHeight < tree.lower.position.y) {
                    // collision
                    if (gamemode !== "over") onGameOver();
                }
                if (localDragonHeight + dragonHeight > tree.upper.position.y) {
                    // collision
                    if (gamemode !== "over") onGameOver();
                }

                //$('#status').html("in");
            }
        }
    }

    //dragon.rotation.z = upVelocity;  // FIXME: Can't do this because current obj file has off pivot that's not at the origin.

    // move dragon around the ring
    if (!isDead) {
        localDragonAngle += dragonspeed * delta;
        if (localDragonAngle > twoPi) {
            localDragonAngle = localDragonAngle % (twoPi);
        }
    }

    // update sync data
    if (typeof gamestate.userData.syncData === "undefined") {
        gamestate.userData.syncData = {};
    }

    var state = gamestate.userData.syncData;

    // hack to get high scores to show.. the delay is needed because syncData doesn't seem to initialize right away.  Amber said she may look into this.
    if (!highScoresShown) {
        highScoresShown = true;
        setTimeout(function () {
            displayHighScores();
        },3000)
        
    }


    if (isLocalPlay) {
        // we're playing a local game so update and sync gamestate to others
        state.dragonAngle = localDragonAngle;
        state.dragonHeight = localDragonHeight;
        state.flaps = localFlaps;
        state.score = score;

        dragon.rotation.y = state.dragonAngle;
        dragon.position.y = state.dragonHeight;

        if (!isDead) {
            state.status = localUser.displayName + "'s Score";
        }
        else {
            updateHighScores();
            localFlaps = 0;
            state.status = "Game Over!";
            state.flaps = 0;
        }

        firebaseSync.saveObject(gamestate);
    }
    else {
        // is someone else playing?
        if (state.lockedUserId) {

            dragon.rotation.y = state.dragonAngle;
            dragon.position.y = state.dragonHeight;

            // try to keep everyone's local dragon at the same place around the ring
            localDragonAngle = state.dragonAngle;

            // have to play sounds

            if (lastSyncScore != state.score) {
                PlayScoreSound();
            }
            lastSyncScore = state.score;

            if (lastSyncFlaps !== state.flaps) {
                PlayFlapSound();
            }
            lastSyncFlaps = state.flaps;

            if (lastSyncStatus !== "Game Over!" && state.status === "Game Over!") {
                setTimeout(displayHighScores, 1000); // give it a second to update and sync highscores before redisplaying.
                PlayDeathSounds();
            }
            lastSyncStatus = state.status;
        }
        else {
            // no one anywhere is playing, just use local data.
            dragon.rotation.y = localDragonAngle;
            dragon.position.y = localDragonHeight;
        }
    }

    $('#score').html(state.score);
    $('#status').html(state.status);

    // update html 
    $('#stats #delta').text(delta.toFixed(3));
    $('#stats #time').text(time.toFixed(3));
    $('#stats #fps').text(Math.round(fps));


    showSyncInfo();



    updateClouds();

    if (inAltspace) {
        window.requestAnimationFrame(animate);
    }
    else {
        setTimeout(function () {
            requestAnimationFrame(animate);
        }, 1000 / 60);
    }

    renderer.render(scene, camera);

    localFlap = false;
};


if (inAltspace) {
    window.addEventListener("AltContentLoaded", Init);
}
else {
    Init();
}

