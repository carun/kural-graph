// The server always renders the home page. A link straight into a tool (?view=…, or the older ?node=/?trace=/?ask=)
// hides it before first paint so it doesn't flash; page.tsx clears the flag once that tool is showing.
// Mirrors viewFromQuery() in page.tsx. A file rather than an inline script because public/_headers blocks inline scripts.
try{var q=new URLSearchParams(location.search),v=q.get('view');if(v?v!=='home':(q.get('node')||q.get('trace')||q.get('ask')||q.get('chat')==='1'))document.documentElement.dataset.entry='deep'}catch(e){}
