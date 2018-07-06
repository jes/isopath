/* isopath game rules and state tracking */
function Isopath() {
    // the set of all valid places
    this.all_places = [
          'a1','a2','a3','a4',
        'b1','b2','b3','b4','b5',
      'c1','c2','c3','c4','c5','c6',
    'd1','d2','d3','d4','d5','d6','d7',
      'e1','e2','e3','e4','e5','e6',
        'f1','f2','f3','f4','f5',
          'g1','g2','g3','g4'
    ];

    this.homerow = {
        'white':['a1','a2','a3','a4'],
        'black':['g1','g2','g3','g4'],
    };

    this.playerlevel = {
        'white': 2,
        'black': 0,
    };

    this.tilemovecounter = {
        'white': 0,
        'black': 0,
    };
    this.relevant_tiles = [];

    this.other = {
        'white': 'black',
        'black': 'white',
    };

    // build an adjacency list of all of the places
    this.adjacent = {};
    for (var i = 0; i < this.all_places.length; i++) {
        var place = this.all_places[i];
        var row = place.charAt(0);
        var column = Number.parseInt(place.charAt(1));

        // add candidate places to adj; invalid place names are filtered out before
        // insertion into this.adjacent
        adj = [];

        adj.push(row + (column-1));
        adj.push(row + (column+1));

        var prevrow = String.fromCharCode(place.charCodeAt(0)-1);
        var nextrow = String.fromCharCode(place.charCodeAt(0)+1);

        adj.push(prevrow + column);
        adj.push(nextrow + column);

        if (['a','b','c','d'].indexOf(row) != -1) {
            adj.push(prevrow+(column-1));
        } else {
            adj.push(prevrow+(column+1));
        }

        if (['a','b','c'].indexOf(row) != -1) {
            adj.push(nextrow+(column+1));
        } else {
            adj.push(nextrow+(column-1));
        }

        this.adjacent[place] = [];
        for (var j = 0; j < adj.length; j++) {
            if (this.is_place(adj[j]))
                this.adjacent[place].push(adj[j]);
        }
    }

    // lateral teleports
    this.adjacent["g1"].push("g4");
    this.adjacent["g4"].push("g1");
    this.adjacent["d1"].push("d7");
    this.adjacent["d7"].push("d1");
    this.adjacent["a1"].push("a4");
    this.adjacent["a4"].push("a1");

    // game state tracking
    this.moves = [];
    this.curplayer = 'white';

    // pieces are initially on the players' home rows
    this.board = {
        'white':this.homerow["white"].slice(),
        'black':this.homerow["black"].slice(),
    };

    // most places have height=1...
    for (var i = 0; i < this.all_places.length; i++) {
        this.board[this.all_places[i]] = 1;
    }
    // ...apart from the home rows
    for (var i = 0; i < 4; i++) {
        this.board[this.homerow["white"][i]] = this.playerlevel['white'];
        this.board[this.homerow["black"][i]] = this.playerlevel['black'];
    }
}

Isopath.prototype.is_place = function(place) {
    return this.all_places.indexOf(place) != -1;
};

// return 'white', 'black', or '' depending on what piece (if any) is on this place
Isopath.prototype.piece_at = function(place, brd) {
    if (!brd)
        brd = this.board;

    if (brd["white"].indexOf(place) != -1)
        return 'white';
    if (brd["black"].indexOf(place) != -1)
        return 'black';
    return '';
};

Isopath.prototype.winner = function(brd) {
    if (!brd)
        brd = this.board;

    // if one player has captured all of the opponent's pieces, he wins
    if (brd["white"].length == 0)
        return 'black';
    if (brd["black"].length == 0)
        return 'white';

    // if one player has reached the opponent's home row, he wins
    for (var i = 0; i < 4; i++) {
        if (this.piece_at(this.homerow["white"][i],brd) == 'black')
            return 'black';
        if (this.piece_at(this.homerow["black"][i],brd) == 'white')
            return 'white';
    }
    return false;
};

Isopath.prototype.undoMove = function() {
    var move = this.moves.pop();
    this.curplayer = this.other[this.curplayer];

    for (var i = move.length-1; i >= 0; i--) {
        var movetype = move[i][0];
        var from = move[i][1];
        var to = move[i][2];

        if (movetype == 'tile') {
            this.board[to]--;
            this.board[from]++;
        } else if (movetype == 'piece') {
            this.board[this.curplayer][this.board[this.curplayer].indexOf(to)] = from;
        } else if (movetype == 'capture') {
            this.board[this.other[this.curplayer]].push(from);
        }
    }

    // TODO: read last 3 moves and update state for anti-stalemate rule
};

Isopath.prototype.playMove = function(move, mode) {
    if (!mode || mode != 'no-legality-check')
        this.checkMoveLegality(move);

    var have_tile_move = false;

    for (var i = 0; i < move.length; i++) {
        let movetype = move[i][0];
        let from = move[i][1];
        let to = move[i][2];

        if (movetype == 'tile') {
            this.board[from]--;
            this.board[to]++;
            if (this.relevant_tiles.indexOf(from) != -1 || this.relevant_tiles.indexOf(to) != -1)
                this.tilemovecounter[this.curplayer]++;
            else
                this.tilemovecounter[this.curplayer] = 0;
            this.relevant_tiles = [from,to];
            have_tile_move = true;
        } else if (movetype == 'piece') {
            this.board[this.curplayer][this.board[this.curplayer].indexOf(from)] = to;
        } else if (movetype == 'capture') {
            this.board[this.other[this.curplayer]].splice(this.board[this.other[this.curplayer]].indexOf(from), 1);
        }
    }

    this.moves.push(move);
    this.curplayer = this.other[this.curplayer];
    if (!have_tile_move)
        this.relevant_tiles = [];
};

Isopath.prototype.checkMoveLegality = function(move, mode) {
    if (move.length == 0)
        throw "move must have at least 1 half";
    if (move.length > 2)
        throw "move may never have more than 2 halves";
    if (move.length == 2 && move[0][0] == move[1][0])
        throw "can't play two halfmoves of the same type";

    var have_winner = false;
    var captured_at = '';
    var piece_to = '';
    var piece_from = '';
    var tile_to = '';
    var tile_from = '';

    for (var i = 0; i < move.length; i++) {
        let movetype = move[i][0];
        let from = move[i][1];
        let to = move[i][2];

        if (!this.is_place(from))
            throw "place " + from + " is not recognised";
        if (movetype != 'capture' && !this.is_place(to))
            throw "place " + to + " is not recognised";
        if (movetype != 'capture' && from == to)
            throw "can't move something from a tile to the same tile";

        if (movetype == 'tile') {
            if (this.board[from] == 0)
                throw "can't move a tile from an empty place";
            if (this.board[to] == 2)
                throw "can't move a tile to a full place";
            if (this.homerow[this.curplayer].indexOf(from) != -1 || this.homerow[this.curplayer].indexOf(to) != -1)
                throw "can't build on your own home row";
            if (piece_from != to && (piece_to == to || this.board["black"].indexOf(to) != -1 || this.board["white"].indexOf(to) != -1))
                throw "can't move a tile to a place with a piece on it";
            if (piece_from != from && (piece_to == from || this.board["black"].indexOf(from) != -1 || this.board["white"].indexOf(from) != -1))
                throw "can't move a tile from a place with a piece on it";
            if (this.tilemovecounter[this.curplayer] >= 2 && (this.relevant_tiles.indexOf(from) != -1 || this.relevant_tiles.indexOf(to) != -1))
                throw "can't touch a tile that an opponent touched 3 turns in a row";

            tile_to = to;
            tile_from = from;

        } else if (movetype == 'piece') {
            if (this.piece_at(from) != this.curplayer)
                throw "can't move a piece you don't have";
            if (this.piece_at(to) != '' && captured_at != to)
                throw "can't move to an occupied place";
            if (this.playerlevel[this.curplayer] == 2) {
                if ((this.board[to] != 2 || tile_from == to) && (this.board[to] != 1 || tile_to != to))
                    throw "can't move a piece to a place of the wrong height";
            } else {
                if ((this.board[to] != 0 || tile_to == to) && (this.board[to] != 1 || tile_from != to))
                    throw "can't move a piece to a place of the wrong height";
            }
            if (this.adjacent[from].indexOf(to) == -1)
                throw "can't move to a non-adjacent place";

            piece_to = to;
            piece_from = from;

            // moved on to his home row
            if (this.homerow[this.other[this.curplayer]].indexOf(to) != -1)
                have_winner = true;

        } else if (movetype == 'capture') {
            if (this.piece_at(from) != this.other[this.curplayer])
                throw "can't capture anything other than an enemy";
            var adjacent_men = 0;
            for (var j = 0; j < this.adjacent[from].length; j++) {
                // check where curplayer's men were on this.board (instead of this.board)
                // because the piece must have been capturable at the start of this turn,
                // i.e. you can't walk up to an enemy and capture him all in one turn
                if (this.piece_at(this.adjacent[from][j]) == this.curplayer)
                    adjacent_men++;
            }
            if (adjacent_men < 2)
                throw "can't capture without 2 pieces threatening";

            // captured his final man
            if (this.board[this.other[this.curplayer]].length == 1)
                have_winner = true;

            captured_at = from;

        } else {
            throw "don't recognise move type " + movetype;
        }
    }

    if (move.length == 1 && !have_winner && (!mode || mode != 'halfmove-check'))
        throw "move must have two halves except when the first half wins the game";
};

Isopath.prototype.isLegalMove = function(move, mode) {
    try {
        this.checkMoveLegality(move, mode);
    } catch(e) {
        return false;
    };
    return true;
};

Isopath.prototype.clone = function() {
    var newthis = new Isopath();
    newthis.board = JSON.parse(JSON.stringify(this.board));
    newthis.moves = JSON.parse(JSON.stringify(this.moves));
    newthis.curplayer = this.curplayer;
    return newthis;
};
