/* =====================================================================
   LOCAL MODE: stands in for the Supabase library (supabase-js).

   Loaded instead of the Supabase CDN script. It gives the app the same
   window.supabase.createClient() it expects, but every call goes to the
   local server (local/server.mjs) on this Mac, which keeps the data in
   local/data/db.json. Nothing is sent to Supabase or any other service.

   You are always signed in as the one local owner, so there is no
   password. Tables the local server does not know return empty lists, and
   server functions (rpc / functions.invoke) return nothing, so the spaces
   other than Social Media stay quiet instead of erroring.
   ===================================================================== */
(function(){
"use strict";

const LOCAL_USER = { id: "local-owner", email: "owner@local" };
const SESSION = { access_token: "local", user: LOCAL_USER };

async function call(path, body){
  try{
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
    const j = await r.json();
    return { data: j.data === undefined ? null : j.data, error: j.error ? { message: j.error } : null, count: j.count ?? null };
  }catch(e){
    return { data: null, error: { message: "Local server not reachable (" + e.message + ")" }, count: null };
  }
}

// a thenable query builder recording what to do, sent once when awaited
class Query {
  constructor(table){ this.q = { table, op: "select", columns: "*", filters: [], order: [], limit: null, single: null, values: null, onConflict: null }; }
  select(cols){ if(this.q.op === "select") this.q.columns = cols || "*"; else this.q.returning = true; return this; }
  insert(v){ this.q.op = "insert"; this.q.values = v; return this; }
  upsert(v, o){ this.q.op = "upsert"; this.q.values = v; this.q.onConflict = (o && o.onConflict) || null; return this; }
  update(v){ this.q.op = "update"; this.q.values = v; return this; }
  delete(){ this.q.op = "delete"; return this; }
  _f(kind, col, val){ this.q.filters.push([kind, col, val]); return this; }
  eq(c, v){ return this._f("eq", c, v); }
  neq(c, v){ return this._f("neq", c, v); }
  gt(c, v){ return this._f("gt", c, v); }
  gte(c, v){ return this._f("gte", c, v); }
  lt(c, v){ return this._f("lt", c, v); }
  lte(c, v){ return this._f("lte", c, v); }
  in(c, v){ return this._f("in", c, v); }
  is(c, v){ return this._f("is", c, v); }
  contains(c, v){ return this._f("contains", c, v); }
  match(o){ Object.keys(o || {}).forEach(k => this._f("eq", k, o[k])); return this; }
  order(c, o){ this.q.order.push([c, !(o && o.ascending === false)]); return this; }
  limit(n){ this.q.limit = n; return this; }
  range(a, b){ this.q.offset = a; this.q.limit = b - a + 1; return this; }
  single(){ this.q.single = "single"; return this; }
  maybeSingle(){ this.q.single = "maybe"; return this; }
  then(ok, bad){ return call("/api/db", this.q).then(ok, bad); }
}

function createClient(){
  return {
    from: t => new Query(t),
    rpc: (name, args) => call("/api/rpc/" + encodeURIComponent(name), args || {}),
    functions: { invoke: (name, o) => call("/api/fn/" + encodeURIComponent(name), (o && o.body) || {}) },
    auth: {
      getSession: async () => ({ data: { session: SESSION }, error: null }),
      getUser: async () => ({ data: { user: LOCAL_USER }, error: null }),
      signInWithPassword: async () => ({ data: { user: LOCAL_USER, session: SESSION }, error: null }),
      signOut: async () => ({ error: null }),
      updateUser: async () => ({ data: { user: LOCAL_USER }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
    },
    // live updates: not used locally (one person, one browser)
    channel: () => { const ch = { on(){ return ch; }, subscribe(){ return ch; }, unsubscribe(){} }; return ch; },
    removeChannel(){},
    storage: { from: () => ({ upload: async () => ({ data: null, error: { message: "No file storage in local mode" } }),
                              getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  };
}

window.supabase = { createClient };
window.LOCAL_MODE = true;

// Social Media only: hide the top tabs for the other parts of the app
// (OKRs, My Team, Let's Play, Our Culture). Their data isn't kept locally.
const css = document.createElement("style");
css.textContent = "#nav-b,#nav-d,#nav-h,#nav-i{display:none!important}";
document.head.appendChild(css);
})();
