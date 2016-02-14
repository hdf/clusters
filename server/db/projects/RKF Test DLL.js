function(d, dll_path, i, cb) {
  var ffi = require('ffi'),
      ref = require('ref');
  var dll = ffi.Library(dll_path, {
    'calculator': [ 'float' , [ ref.refType(ref.types.char), 'bool',
                                'long', 'long', 'long', 'long', 'double',
                                'double', 'double', 'double', 'double' ] ]
  });
  var r = new Buffer(4e+7); // 40 Megabyte buffer space
  if (typeof cb === 'function') {
    dll.calculator.async(r, true, d.begin, d.end, d.MMM, d.NNN, d.days, d.xstart, d.ystart, d.xres, d.yres,
      function (err, res) {
        if (err) console.log(err);
        //console.log('Ran for: ' + (Math.round(res * 1000) / 1000) + ' seconds.');
        cb(ref.readCString(r, 0), i);
    });
  } else {
    var ret = dll.calculator(r, true, d.begin, d.end, d.MMM, d.NNN, d.days, d.xstart, d.ystart, d.xres, d.yres);
    //console.log('Ran for: ' + (Math.round(res * 1000) / 1000) + ' seconds.');
    return ref.readCString(r, 0);
  }
}
