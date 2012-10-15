###
Sofoque (/sɔːˈfɔː.kɛ/) a profiler middleware tospot performance suffocating conditions in express/connect applications
###
os = require('os')
fs = require('fs')

# Configuration
conf = {}

# Default callback
defaultCallback = console.error

# Poll CPU usage every #{CPU_SAMPLE_RATE} ms
CPU_SAMPLE_RATE = 250

# Current CPU load
currentCPULoad = 0

# Get process own's CPU load loop
# TODO: Must support other OS. This relies on procfs, so only solaris and linux works for now...
(getCPUload = ->
  # Get Process utime + stime info
  getProcInfo = (callback) ->
    fs.readFile "/proc/#{process.pid}/stat", (err, data) ->
      callback data.toString().split(' ').splice(13,2).reduce(((a,b)->Number(b)+a), 0)

  start = 0
  getProcInfo (data) ->
    start = {time:Date.now(),data}
    setTimeout ->
      getProcInfo (data) ->
        time = Date.now() - start.time
        currentCPULoad = Math.round((data - start.data) * (1000 / time) * 100) / 100
        getCPUload()
    ,
    CPU_SAMPLE_RATE
)()

# The sofoque profiling middleware
sofoqueMiddleware = (req, res, next) ->
  # Only do this once.
  next() if req.sofoque?
  req.sofoque = true

  # Complete response data with the 'after' values
  res.on 'header', ->
    res.sofoque.query = req.query
    res.sofoque.body = req.body
    res.sofoque.after =
      cpuLoad:
        system: os.loadavg
        process: currentCPULoad
      memoryUsage: process.memoryUsage()

    # call the callback function with profile data
    conf.callback {Sofoque: res.sofoque}    

  # Prepare profile data
  res.sofoque =
    method: req.method
    path: req.path
    duration: Date.now()
    before:
      cpuLoad:
        system: os.loadavg
        process: currentCPULoad
      memoryUsage: process.memoryUsage()

  # Move on with your life
  next()

module.exports = (callback=defaultCallback) ->  
  conf = {callback}
  sofoqueMiddleware
