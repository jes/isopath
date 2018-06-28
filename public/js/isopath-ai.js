/* Isopath AI registry */

function IsopathAI(type, isopath) {
    return IsopathAI.make_ai[type].generator(isopath);
}

IsopathAI.make_ai = {};

IsopathAI.register_ai = function(type, name, generator) {
    IsopathAI.make_ai[type] = {
        name: name,
        generator: generator,
    };
};

IsopathAI.list_ais = function() {
    return JSON.parse(JSON.stringify(IsopathAI.make_ai));
};
