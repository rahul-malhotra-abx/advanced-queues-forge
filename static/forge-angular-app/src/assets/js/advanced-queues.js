// Setting error logging.
console.error = function () {
  console.log('RT [E]:', ...arguments);
};

const resizeChecker = setInterval(() => {
  if (document.getElementById('response-template-wrapper')) {
    clearInterval(resizeChecker);
    new ResizeSensor(document.getElementById('response-template-wrapper'), async function () {
      if (window.AP && window.AP.context) {
        const context = await window.AP.context.getContext();
        if (context.jira.issue) {
          // Inside Jira Issue.
          const currentHeight = document.getElementById('response-template-wrapper').offsetHeight;
          if (currentHeight) {
            window.AP.resize('100%', currentHeight < 60 ? 60 : currentHeight + 'px');
          }
        }
      }
    });
  }
}, 100);

function getParentDomain() {
  let domain = window.location.origin;
  try {
    domain = document.location.ancestorOrigins[0] || window.location.origin;
  } catch (e) {}
  return domain;
}

// Google Analytics
(function (i, s, o, g, r, a, m) {
  i['GoogleAnalyticsObject'] = r;
  i[r] =
    i[r] ||
    function () {
      (i[r].q = i[r].q || []).push(arguments);
    };
  i[r].l = 1 * new Date();
  a = s.createElement(o);
  m = s.getElementsByTagName(o)[0];
  a.async = 1;
  a.src = g;
  m.parentNode.insertBefore(a, m);
})(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');

(async () => {
  let userId;
  ga('create', 'UA-181882142-5', {
    storage: 'none',
    clientId: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }),
  });
  setTimeout(async () => {
    if (window.parent !== window) {
      try {
        userId = await window.AP.getCurrentUser();
      } catch (e) {
        userId = 'anonymous';
      }
    } else {
      userId = 'anonymous';
    }
    ga('set', 'userId', userId);
  }, 2000);
})();

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}
