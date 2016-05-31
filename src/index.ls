{check_required_envs} = require \envs-checker
task_name = process.env.TASK_NAME

do main = ->
  <- check_required_envs <[TASK_NAME]>
  do require "./tasks/#task_name.ls"
