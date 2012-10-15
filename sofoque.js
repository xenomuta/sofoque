/*
Sofoque (/sɔːˈfɔː.kɛ/) injects a profiler middleware into an express/connect application to spot performance suffocating conditions
*/

var CPU_SAMPLE_RATE, conf, currentCPULoad, defaultCallback, fs, getCPUload, os, sofoqueMiddleware;

os = require('os');

fs = require('fs');

conf = {};

defaultCallback = console.error;

CPU_SAMPLE_RATE = 250;

currentCPULoad = 0;

(getCPUload = function() {
  var getProcInfo, start;
  getProcInfo = function(callback) {
    return fs.readFile("/proc/" + process.pid + "/stat", function(err, data) {
      return callback(data.toString().split(' ').splice(13, 2).reduce((function(a, b) {
        return Number(b) + a;
      }), 0));
    });
  };
  start = 0;
  return getProcInfo(function(data) {
    start = {
      time: Date.now(),
      data: data
    };
    return setTimeout(function() {
      return getProcInfo(function(data) {
        var time;
        time = Date.now() - start.time;
        currentCPULoad = Math.round((data - start.data) * (1000 / time) * 100) / 100;
        return getCPUload();
      });
    }, CPU_SAMPLE_RATE);
  });
})();

sofoqueMiddleware = function(req, res, next) {
  if (req.sofoque != null) {
    next();
  }
  req.sofoque = true;
  res.on('header', function() {
    res.sofoque.query = req.query;
    res.sofoque.body = req.body;
    res.sofoque.after = {
      cpuLoad: {
        system: os.loadavg,
        process: currentCPULoad
      },
      memoryUsage: process.memoryUsage()
    };
    return conf.callback.apply(conf.app, {
      Sofoque: res.sofoque
    });
  });
  res.sofoque = {
    method: req.method,
    path: req.path,
    duration: Date.now(),
    before: {
      cpuLoad: {
        system: os.loadavg,
        process: currentCPULoad
      },
      memoryUsage: process.memoryUsage()
    }
  };
  return next();
};

module.exports = function(app, callback) {
  var _ref;
  if (callback == null) {
    callback = defaultCallback;
  }
  if ((app != null ? (_ref = app.stack) != null ? _ref[1] : void 0 : void 0) == null) {
    return null;
  }
  conf = {
    app: app,
    callback: callback
  };
  return app.stack = [
    {
      route: '',
      handle: sofokeMiddleware
    }
  ].concat(app.stack);
};
