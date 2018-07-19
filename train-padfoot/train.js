// https://nodejs.org/api/modules.html
var fs = require('fs');
eval(fs.readFileSync('../public/js/isopath.js').toString());
eval(fs.readFileSync('../public/js/isopath-ai.js').toString());
eval(fs.readFileSync('../public/js/ai/padfoot.js').toString());

var generation = 1;
var population =
[ { constants: [ 1.36, 2.44, 5.85, 16.77, 73.24, 237.68, 0.98, 637.14, 69.08, 0.05, 0 ],
    score: 0 },
  { constants: [ 1.36, 2.28, 6.93, 16.47, 63.92, 237.68, 0.98, 637.14, 69.08, 0.05, 0 ],
    score: 0 },
  { constants: [ 1.36, 2.44, 6.93, 14.42, 73.24, 1667.41, 0.98, 637.14, 69.08, 0.05, 0 ],
    score: 0 },
  { constants: [ 1.36, 2.28, 6.93, 16.47, 73.24, 18.54, 0.98, 637.14, 69.08, 0, 0 ],
    score: 0 },
  { constants: [ 1.36, 2.28, 0.08, 16.47, 73.24, 237.68, 0.98, 637.14, 69.08, 0.05, 0 ],
    score: 0 },
  { constants: [ 1.36, 2.44, 7.74, 16.47, 73.24, 237.68, 0.98, 637.14, 69.08, 0.05, 0 ],
    score: 0 }
  { constants: [1,2,3,4,5,6,1,1000,1000,2,0.5],
    score: 0},
 ]
;

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
        if (Math.random() > 0.99) {
            child[i] = Math.round(100 * child[i] * (Math.random() * 10)) / 100;
        }
        if (Math.random() > 0.99) {
            child[i] = Math.round(100 * child[i] * (Math.random() * 0.1)) / 100;
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
    console.log(population);
}

function round_robin_tournament() {
    console.log("");
    console.log("Generation " + generation + ":");
    for (var i = 0; i < population.length; i++) {
        for (var j = 0; j < population.length; j++) {
            if (i == j)
                continue;

            console.log(JSON.stringify(population[i].constants) + " v " + JSON.stringify(population[j].constants));

            var isopath = new Isopath();
            var white = new Padfoot(isopath, population[i].constants, 2, 3);
            var black = new Padfoot(isopath, population[j].constants, 2, 3);

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
