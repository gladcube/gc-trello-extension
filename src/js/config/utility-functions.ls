arrayify = (obj)-> Array::slice.call obj, 0
trim = (str)-> str.replace /\s/g, ""
