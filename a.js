let res = []
function fun(count, pre = '') {

  if (count == 0) {
    if (res.indexOf(pre) == -1) {
      res.push(pre)
    }
    return;
  }

  fun(count - 1, pre + '()')
  fun(count - 1, '()' + pre)
  fun(count - 1, '(' + pre + ')')
}

fun(20);
console.log(res);