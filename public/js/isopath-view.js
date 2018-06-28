/* code to draw an isopath game board and take player input */
function IsopathView(opts) {
    this.opts = opts;
    this.idprefix = Date.now();
    this.move = [];
    this.clickmode = '';
    this.movefrom = '';

    this.place_to_hex = {
                    a1:41, a2:42, a3:43, a4:44,
                b1:34, b2:35, b3:36, b4:37, b5:38,
            c1:27, c2:28, c3:29, c4:30, c5:31, c6:32,
        d1:20, d2:21, d3:22, d4:23, d5:24, d6:25, d7:26,
            e1:14, e2:15, e3:16, e4:17, e5:18, e6:19,
                f1: 8, f2: 9, f3:10, f4:11, f5:12,
                    g1: 2, g2: 3, g3: 4, g4: 5,
    };
}

IsopathView.prototype.clicked_on_hex = function(place) {
    var movedone = false;

    this.opts.clicked(place);

    if (!this.opts.can_click())
        return;

    var this_place_has = this.opts.isopath.piece_at(place);
    if (this.move.length > 0 && this.move[0][0] == 'piece' && this.move[0][1] == place)
        this_place_has = '';
    if (this.move.length > 0 && this.move[0][0] == 'piece' && this.move[0][2] == place)
        this_place_has = this.opts.isopath.curplayer;

    if (this.clickmode == 'piece') {
        if (this_place_has == '' && place != this.movefrom && this.opts.isopath.board[place] == this.opts.isopath.playerlevel[this.opts.isopath.curplayer]) {
            this.move.push(["piece",this.movefrom,place]);
            if (this.opts.isopath.homerow[this.opts.isopath.other[this.opts.isopath.curplayer]].indexOf(place) != -1) {
                // we placed a piece on the enemy's homerow, no need for a second move-half
                movedone = true;
            }
        }
        this.clickmode = '';
    } else if (this.clickmode == 'tile') {
        if (this_place_has == '' && place != this.movefrom)
            this.move.push(["tile",this.movefrom,place]);
        this.clickmode = '';
    } else {
        this.clickmode = '';
        if (this_place_has == this.opts.isopath.other[this.opts.isopath.curplayer]) {
            // capture
            this.move.push(["capture",place]);
        } else if (this_place_has == this.opts.isopath.curplayer) {
            // start moving a piece
            this.clickmode = 'piece';
            this.movefrom = place;
        } else {
            // start moving a tile
            this.clickmode = 'tile';
            this.movefrom = place;
        }
    }

    if (movedone || this.move.length == 2) {
        this.opts.move(this.move);
        this.clickmode = '';
        this.move = [];
    }
    this.opts.redraw();
};

IsopathView.prototype.redraw = function() {
    for (var place in this.place_to_hex) {
        var idx = this.place_to_hex[place];
        var piece = this.opts.isopath.piece_at(place);
        var height = this.opts.isopath.board[place];

        // update state for completed halfmove
        if (this.move.length == 1) {
            if (this.move[0][0] == 'capture' && this.move[0][1] == place)
                piece = '';
            if (this.move[0][0] == 'tile' && this.move[0][1] == place)
                height--;
            if (this.move[0][0] == 'tile' && this.move[0][2] == place)
                height++;
            if (this.move[0][0] == 'piece' && this.move[0][1] == place)
                piece = '';
            if (this.move[0][0] == 'piece' && this.move[0][2] == place)
                piece = this.opts.isopath.curplayer;
        }

        // update state for partial halfmove
        if (this.clickmode == 'piece' && this.movefrom == place)
            piece = '';
        if (this.clickmode == 'tile' && this.movefrom == place)
            height--;

        $('#' + this.idprefix + '-hex-' + idx).css('background-image', 'url(img/height' + height + piece + '.png');
    }

    var moves = '';
    for (var i = 0; i < this.opts.isopath.moves.length; i++) {
        let move = this.opts.isopath.moves[i];
        if (i%2 == 0)
            moves += "<b>" + Math.round((i+1)/2) + ".</b>";
        moves += this.stringify_move(move, "&nbsp;");
        if (i%2 == 0)
            moves += ",";
        moves += " ";
    }
    var winner = this.opts.isopath.winner();
    if (winner)
        moves += " " + winner + "&nbsp;wins.";
    this.opts.move_history(moves);

    var partialmove = '';
    if (this.opts.can_click()) {
        partialmove = this.stringify_move(this.move, " ");
        if (this.clickmode == 'tile') {
            partialmove += ' ' + 'T' + this.movefrom + '..';
        } else if (this.clickmode == 'piece') {
            partialmove += ' ' + 'P' + this.movefrom + '..';
        }
    }
    this.opts.partial_move(partialmove);
};

// initialise the hex grid in the named div
IsopathView.prototype.init_hexgrid = function(el) {
    $(el).html('');
    // 37 places, plus 8 invisible ones to get the spacing right
    for (var i = 0; i < 45; i++) {
        $('<div class="lab_item"><div class="hexagon hexagon2"><div class="hexagon-in1"><div class="hexagon-in2" id="' + this.idprefix + '-hex-' + (i+1) + '"></div></div></div></div>').appendTo(el);
    }

    var thisview = this;

    for (var place in this.place_to_hex) {
        var idx = this.place_to_hex[place];
        let t = place;
        $('#' + this.idprefix + '-hex-' + idx).click(function() {
            thisview.clicked_on_hex(t);
        });
    }

    this.redraw();
};

IsopathView.prototype.stringify_move = function(x, space) {
    var s = '';
    for (var j = 0; j < x.length; j++) {
        var type = x[j][0];
        var from = x[j][1];
        var to = x[j][2];
        if (type == 'tile')
            s += space + "T" + from + to;
        if (type == 'piece')
            s += space + "P" + from + to;
        if (type == 'capture')
            s += space + "C" + from;
    }

    return s;
};

IsopathView.prototype.reset_move = function() {
    this.move = [];
    this.clickmode = '';
    this.redraw();
};
