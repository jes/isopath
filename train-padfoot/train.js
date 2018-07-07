// https://nodejs.org/api/modules.html
var fs = require('fs');
eval(fs.readFileSync('../public/js/isopath.js').toString());
eval(fs.readFileSync('../public/js/isopath-ai.js').toString());
eval(fs.readFileSync('../public/js/ai/padfoot.js').toString());

var generation = 1;
var population = [
{constants:[1.04,2.18,3.14,3.65,4.77,5.63,1,876.35,1.63,2.48,0.46],score:0},
{constants:[1.04,2.18,3.14,3.63,4.77,5.12,1,876.35,1.63,2.48,0.46],score:0},
{constants:[1.04,2.18,3.14,3.07,4.77,5.63,0.95,922.68,1.63,2.48,0.46],score:0},
{constants:[1.04,2.18,3.14,3.65,4.77,5.63,1,753.86,1.63,2.48,0.46],score:0},
{constants:[0.97,2.18,2.96,3.65,5.15,5.36,1,758.84,1.63,2.48,0.46],score:0},
{constants:[1.04,2.18,3.36,3.65,5.39,5.36,1,848.73,1.63,2.48,0.46],score:0},
];

function combine(a, b) {
    var child = [];

    if (a.length != b.length)
        throw "lengths not equal";

    // swap a and b with 50% probability; for crossover
    if (Math.random() > 0.5) {
        var x = a;
        a = b;
        b = x;
    }

    // crossover
    var crossover = Math.floor(Math.random() * a.length);
    for (var i = 0; i < a.length; i++) {
        if (i < crossover)
            child.push(a[i]);
        else
            child.push(b[i]);
    }

    // mutation
    for (var i = 0; i < child.length; i++) {
        if (Math.random() > 0.9) {
            child[i] = Math.round(100 * child[i] * (0.8 + Math.random() * 0.4)) / 100;
        }
    }

    return child;
}

function reproduce() {
    population.sort(function(a,b) {
        return b.score - a.score;
    });

    console.log("--------------------------");
    console.log("Generation " + generation + " results:");
    for (var i = 0; i < population.length; i++) {
        console.log((i+1) + ". " + JSON.stringify(population[i].constants) + ": " + population[i].score);
    }

    var newpopulation = [];

    // keep the winner
    newpopulation.push({
        constants: population[0].constants,
        score: 0,
    });

    // generate children by combining the top 2 individuals from last generation
    var got = {};
    got[JSON.stringify(population[0].constants)] = true;
    for (var i = 0; i < 5; i++) {
        var consts;
        do {
            consts = combine(population[0].constants, population[1].constants);
        } while(got[JSON.stringify(consts)]);
        got[JSON.stringify(consts)] = true;
        newpopulation.push({
            constants: consts,
            score: 0,
        });
    }

    population = newpopulation;
}

function round_robin_tournament() {
    console.log("");
    console.log("Generation " + generation + ":");
    for (var i = 0; i < population.length; i++) {
        for (var j = i+1; j < population.length; j++) {
            if (i == j)
                continue;

            console.log(JSON.stringify(population[i].constants) + " v " + JSON.stringify(population[j].constants));

            var isopath = new Isopath();
            var white = new Padfoot(isopath, population[i].constants);
            var black = new Padfoot(isopath, population[j].constants);

            var winner = play_game(isopath, white, black, 60);
            if (winner == 'white') {
                population[i].score++;
                console.log("   White wins.");
            } else if (winner == 'black') {
                population[j].score++;
                console.log("   Black wins.");
            } else {
                console.log("   Draw.");
            }
        }
    }
}

function play_game(isopath, white, black, maxturns) {
    for (var i = 0; i < maxturns; i++) {
        try {
            isopath.playMove(white.move());
        } catch(e) {
            console.log("Invalid move from white.");
            return 'black';
        };

        if (isopath.winner())
            return isopath.winner();

        try {
            isopath.playMove(black.move());
        } catch(e) {
            console.log("Invalid move from black.");
            return 'white';
        };

        if (isopath.winner())
            return isopath.winner();
    }

    return '';
}

while (true) {
    round_robin_tournament();
    reproduce();
    generation++;
}
