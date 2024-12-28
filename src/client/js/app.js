var io = require('socket.io-client');
var render = require('./render');
var ChatClient = require('./chat-client');
var Canvas = require('./canvas');
var global = require('./global');

var playerNameInput = document.getElementById('playerNameInput');
var socket;

var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}

function startGame(type) {
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);
    global.playerType = type;

    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;

    document.getElementById('startMenuWrapper').style.maxHeight = '0px';
    document.getElementById('gameAreaWrapper').style.opacity = 1;

    if (!socket) {
        socket = io({ query: "type=" + type });
        setupSocket(socket);
    }

    // Lancer la boucle d'animation
    if (!global.animLoopHandle) animloop();

    // Émettre un heartbeat régulier même en arrière-plan (garantit que le serveur reçoit un signal régulier même si l'onglet est inactif)
    if (!global.heartbeatInterval) {
        global.heartbeatInterval = setInterval(() => {
            if (global.gameStart && socket) {
                socket.emit('0', window.canvas.target); // Émettre un heartbeat
            }
        }, 2000); // Intervalle de 2 secondes (Un intervalle est défini pour envoyer l'événement "0" toutes les 2 secondes)
    }

    socket.emit('respawn');
    window.chat.socket = socket;
    window.chat.registerFunctions();
    window.canvas.socket = socket;
    global.socket = socket;
}


// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

window.onload = function () {

    var btn = document.getElementById('startButton'),
        btnS = document.getElementById('spectateButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    btnS.onclick = function () {
        startGame('spectator');
    };

    btn.onclick = function () {

        // Checks if the nick is valid.
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            startGame('player');
        } else {
            nickErrorText.style.opacity = 1;
        }
    };

    var settingsMenu = document.getElementById('settingsButton');
    var settings = document.getElementById('settings');

    settingsMenu.onclick = function () {
        if (settings.style.maxHeight == '300px') {
            settings.style.maxHeight = '0px';
        } else {
            settings.style.maxHeight = '300px';
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === global.KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame('player');
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

// TODO: Break out into GameControls.

var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: global.screen.width / 2,
    y: global.screen.height / 2,
    screenWidth: global.screen.width,
    screenHeight: global.screen.height,
    target: { x: global.screen.width / 2, y: global.screen.height / 2 }
};
global.player = player;

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var target = { x: player.x, y: player.y };
global.target = target;

window.canvas = new Canvas();
window.chat = new ChatClient();

var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = settings.toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = settings.toggleMass;

var continuitySetting = document.getElementById('continuity');
continuitySetting.onchange = settings.toggleContinuity;

var roundFoodSetting = document.getElementById('roundFood');
roundFoodSetting.onchange = settings.toggleRoundFood;

var c = window.canvas.cv;
var graph = c.getContext('2d');

$("#feed").click(function () {
    socket.emit('1');
    window.canvas.reenviar = false;
});

$("#split").click(function () {
    socket.emit('2');
    window.canvas.reenviar = false;
});

function handleDisconnect() {
    socket.close();
    if (!global.kicked) { // We have a more specific error message 
        render.drawErrorMessage('Guack! Connection lost!', graph, global.screen);
    }
}

// socket stuff.
function setupSocket(socket) {
    // Handle ping.
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
        window.chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    // Handle error.
    socket.on('connect_error', handleDisconnect);
    socket.on('disconnect', handleDisconnect);

    // Handle connection.
    socket.on('welcome', function (playerSettings, gameSizes) {
        player = playerSettings;
        player.name = global.playerName;
        player.screenWidth = global.screen.width;
        player.screenHeight = global.screen.height;
        player.target = window.canvas.target;
        global.player = player;
        window.chat.player = player;
        socket.emit('gotit', player);
        global.gameStart = true;
        window.chat.addSystemLine('Connected to the game!');
        window.chat.addSystemLine('Type <b>-help</b> for a list of commands.');
        if (global.mobile) {
            document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
        }
        c.focus();
        global.game.width = gameSizes.width;
        global.game.height = gameSizes.height;
        resize();
    });

    socket.on('playerDied', (data) => {
        //const player = isUnnamedCell(data.playerEatenName) ? 'An unnamed meme' : data.playerEatenName;
        //const killer = isUnnamedCell(data.playerWhoAtePlayerName) ? 'An unnamed cell' : data.playerWhoAtePlayerName;

        //window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten by <b>' + (killer) + '</b>');
		//window.chat.addSystemLine(`${player} just got REKT!`);
		window.chat.addSystemLine(`${data.name || 'An unnamed meme'} just got REKT!`);
    });

    socket.on('playerDisconnect', (data) => {
        //window.chat.addSystemLine('{GAME} - <b>' + (isUnnamedCell(data.name) ? 'An unnamed meme' : data.name) + '</b> disconnected.');
		window.chat.addSystemLine(`${data.name || 'An unnamed meme'} left.`);
    });
	
	const welcomeMessages = [
		"Welcome {name}! May your memes reign supreme!",
		"{name} has entered the meme arena! Brace yourselves!",
		"Look who's here! It's {name}! Ready to dominate?",
		"{name} joined the chaos! Let the memes begin!",
		"Oh snap! {name} is here. Let's meme it up!",
		"Activate ray shields, {name} just joined.",
		"{name} joined, let him cook. 🍪",
		"A chill {name} entered.",
		"Sup {name}.",
		"What if I told you... {name} appeared.",
		"A wild {name} entered the house.",
		"Dank {name} joined."
	];
	
	function getRandomWelcomeMessage(name) {
		const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
		return welcomeMessages[randomIndex].replace('{name}', name || 'An unnamed meme');
	}

    socket.on('playerJoin', (data) => {
        //window.chat.addSystemLine(`Welcome ${data.name || 'An unnamed meme'}! May your memes reign supreme!`);
		const randomMessage = getRandomWelcomeMessage(data.name);
		window.chat.addSystemLine(randomMessage);
    });

    socket.on('leaderboard', (data) => {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            if (leaderboard[i].id == player.id) {
                if (leaderboard[i].name.length !== 0)
                    status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + "</span>";
                else
                    status += '<span class="me">' + (i + 1) + ". An unnamed meme</span>";
            } else {
                if (leaderboard[i].name.length !== 0)
                    status += (i + 1) + '. ' + leaderboard[i].name;
                else
                    status += (i + 1) + '. An unnamed meme';
            }
        }
        //status += '<br />Players: ' + data.players;
        document.getElementById('status').innerHTML = status;
    });

    socket.on('serverMSG', function (data) {
        window.chat.addSystemLine(data);
    });

    // Chat.
    socket.on('serverSendPlayerChat', function (data) {
        window.chat.addChatLine(data.sender, data.message, false);
    });

    // Handle movement.
    socket.on('serverTellPlayerMove', function (playerData, userData, foodsList, massList, virusList) {
        if (global.playerType == 'player') {
            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.cells = playerData.cells;
        }
        users = userData;
        foods = foodsList;
        viruses = virusList;
        fireFood = massList;
    });

    // Death.
    socket.on('RIP', function () {
        global.gameStart = false;
		
		// Jouer le son de défaite
		var dead = document.getElementById('dead');
		if (dead) {
			dead.play().catch(error => console.error('Error playing lose sound:', error));
		}
		
		window.chat.addSystemLine(`${player.name} just got REKT!`);
	
        render.drawErrorMessage('Bruh, you got eaten!', graph, global.screen);
        window.setTimeout(() => {
            document.getElementById('gameAreaWrapper').style.opacity = 0;
            document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
            if (global.animLoopHandle) {
                window.cancelAnimationFrame(global.animLoopHandle);
                global.animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on('kick', function (reason) {
        global.gameStart = false;
        global.kicked = true;
        if (reason !== '') {
            render.drawErrorMessage('You were kicked for: ' + reason, graph, global.screen);
        }
        else {
            render.drawErrorMessage('You were kicked!', graph, global.screen);
        }
        socket.close();
    });
}

const isUnnamedCell = (name) => name.length < 1;

const getPosition = (entity, player, screen) => {
    return {
        x: entity.x - player.x + screen.width / 2,
        y: entity.y - player.y + screen.height / 2
    }
}

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

window.cancelAnimFrame = (function (handle) {
    return window.cancelAnimationFrame ||
        window.mozCancelAnimationFrame;
})();

function animloop() {
    global.animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}

function gameLoop() {
    if (global.gameStart) {
        graph.fillStyle = global.backgroundColor;
        graph.fillRect(0, 0, global.screen.width, global.screen.height);

        render.drawGrid(global, player, global.screen, graph);
        foods.forEach(food => {
            let position = getPosition(food, player, global.screen);
            render.drawFood(position, food, graph);
        });
        fireFood.forEach(fireFood => {
            let position = getPosition(fireFood, player, global.screen);
            render.drawFireFood(position, fireFood, playerConfig, graph);
        });
        viruses.forEach(virus => {
            let position = getPosition(virus, player, global.screen);
            render.drawVirus(position, virus, graph);
        });


        let borders = { // Position of the borders on the screen
            left: global.screen.width / 2 - player.x,
            right: global.screen.width / 2 + global.game.width - player.x,
            top: global.screen.height / 2 - player.y,
            bottom: global.screen.height / 2 + global.game.height - player.y
        }
        if (global.borderDraw) {
            render.drawBorder(borders, graph);
        }
		
		var memeImages = {
			"trollface": new Image(),
			"doge": new Image(),
			"pepe": new Image(),
			"hawktuah": new Image(),
			"amogus": new Image(),
			"bean": new Image(),
			"blinkingguy": new Image(),
			"cat": new Image(),
			"chad": new Image(),
			"chillguy": new Image(),
			"cz": new Image(),
			"ah": new Image(),
			"dev": new Image(),
			"disaster": new Image(),
			"elon": new Image(),
			"enderman": new Image(),
			"evilmorty": new Image(),
			"freezingman": new Image(),
			"fry": new Image(),
			"happy": new Image(),
			"harold": new Image(),
			"hitler": new Image(),
			"kermit": new Image(),
			"littlegirl": new Image(),
			"lolpepe": new Image(),
			"macron": new Image(),
			"madhitler": new Image(),
			"marine": new Image(),
			"megusta": new Image(),
			"merkel": new Image(),
			"monkey": new Image(),
			"morty": new Image(),
			"musicpepe": new Image(),
			"noel": new Image(),
			"patrick": new Image(),
			"pepethegreedy": new Image(),
			"putin": new Image(),
			"rick": new Image(),
			"risitas": new Image(),
			"sadpepe": new Image(),
			"shutupandtakemymoney": new Image(),
			"skeleton": new Image(),
			"smudge1": new Image(),
			"smudge2": new Image(),
			"spongebob": new Image(),
			"steve": new Image(),
			"thisisfine": new Image(),
			"thundercock": new Image(),
			"trump": new Image(),
			"wideputin": new Image(),
			"womanyelling": new Image(),
			"yaoming": new Image(),
			"zombie": new Image(),
			"Default": new Image()
		};
		memeImages["trollface"].src = "../img/trollface.png";
		memeImages["doge"].src = "../img/doge.png";
		memeImages["pepe"].src = "../img/pepe.png";
		memeImages["hawktuah"].src = "../img/hawktuah.png";
		memeImages["amogus"].src = "../img/amogus.png";
		memeImages["bean"].src = "../img/bean.png";
		memeImages["blinkingguy"].src = "../img/blinkingguy.png";
		memeImages["cat"].src = "../img/cat.png";
		memeImages["chad"].src = "../img/chad.png";
		memeImages["chillguy"].src = "../img/chillguy.png";
		memeImages["cz"].src = "../img/cz.png";
		memeImages["ah"].src = "../img/ah.png";
		memeImages["dev"].src = "../img/dev.png";
		memeImages["disaster"].src = "../img/disaster.png";
		memeImages["elon"].src = "../img/elon.png";
		memeImages["enderman"].src = "../img/enderman.png";
		memeImages["evilmorty"].src = "../img/evilmorty.png";
		memeImages["freezingman"].src = "../img/freezingman.png";
		memeImages["fry"].src = "../img/fry.png";
		memeImages["happy"].src = "../img/happy.png";
		memeImages["harold"].src = "../img/harold.png";
		memeImages["hitler"].src = "../img/hitler.png";
		memeImages["kermit"].src = "../img/kermit.png";
		memeImages["littlegirl"].src = "../img/littlegirl.png";
		memeImages["lolpepe"].src = "../img/lolpepe.png";
		memeImages["macron"].src = "../img/macron.png";
		memeImages["madhitler"].src = "../img/madhitler.png";
		memeImages["marine"].src = "../img/marine.png";
		memeImages["megusta"].src = "../img/megusta.png";
		memeImages["merkel"].src = "../img/merkel.png";
		memeImages["monkey"].src = "../img/monkey.png";
		memeImages["morty"].src = "../img/morty.png";
		memeImages["musicpepe"].src = "../img/musicpepe.png";
		memeImages["noel"].src = "../img/noel.png";
		memeImages["patrick"].src = "../img/patrick.png";
		memeImages["pepethegreedy"].src = "../img/pepethegreedy.png";
		memeImages["putin"].src = "../img/putin.png";
		memeImages["rick"].src = "../img/rick.png";
		memeImages["risitas"].src = "../img/risitas.png";
		memeImages["sadpepe"].src = "../img/sadpepe.png";
		memeImages["shutupandtakemymoney"].src = "../img/shutupandtakemymoney.png";
		memeImages["skeleton"].src = "../img/skeleton.png";
		memeImages["smudge1"].src = "../img/smudge1.png";
		memeImages["smudge2"].src = "../img/smudge2.png";
		memeImages["spongebob"].src = "../img/spongebob.png";
		memeImages["steve"].src = "../img/steve.png";
		memeImages["thisisfine"].src = "../img/thisisfine.png";
		memeImages["thundercock"].src = "../img/thundercock.png";
		memeImages["trump"].src = "../img/trump.png";
		memeImages["wideputin"].src = "../img/wideputin.png";
		memeImages["womanyelling"].src = "../img/womanyelling.png";
		memeImages["yaoming"].src = "../img/yaoming.png";
		memeImages["zombie"].src = "../img/zombie.png";
		memeImages["Default"].src = "../img/pepe.png";


        var cellsToDraw = [];
		for (var i = 0; i < users.length; i++) {
			let img = memeImages[users[i].name] || memeImages["Default"]; // Sélection de l'image en fonction du pseudo

			for (var j = 0; j < users[i].cells.length; j++) {
				cellsToDraw.push({
					img: img, // Ajoute l'image dans l'objet à dessiner
					mass: users[i].cells[j].mass,
					name: users[i].name,
					radius: users[i].cells[j].radius,
					x: users[i].cells[j].x - player.x + global.screen.width / 2,
					y: users[i].cells[j].y - player.y + global.screen.height / 2
				});
			}
		}
        cellsToDraw.sort(function (obj1, obj2) {
            return obj1.mass - obj2.mass;
        });
        render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph);

        socket.emit('0', window.canvas.target); // playerSendTarget "Heartbeat".
    }
}

function updateTopScores() {
    ['daily', 'weekly', 'monthly'].forEach(period => {
        fetch(`/api/top-scores?period=${period}`)
            .then(response => response.json())
            .then(scores => {
                scores.forEach((score, index) => {
                    const element = document.getElementById(`${period}Top${index + 1}`);
                    element.textContent = `${index + 1}. ${score.name}: ${score.score}`;
                });
            })
            .catch(err => console.error(`Error fetching ${period} scores:`, err));
    });
}

// Mettre à jour les scores toutes les 10 secondes
setInterval(updateTopScores, 10000);
updateTopScores();


window.addEventListener('resize', resize);

function resize() {
    if (!socket) return;

    player.screenWidth = c.width = global.screen.width = global.playerType == 'player' ? window.innerWidth : global.game.width;
    player.screenHeight = c.height = global.screen.height = global.playerType == 'player' ? window.innerHeight : global.game.height;

    if (global.playerType == 'spectator') {
        player.x = global.game.width / 2;
        player.y = global.game.height / 2;
    }

    socket.emit('windowResized', { screenWidth: global.screen.width, screenHeight: global.screen.height });
}
