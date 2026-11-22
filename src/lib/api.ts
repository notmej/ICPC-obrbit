import type {Snapshot} from './types';
export async function request<T=unknown>(path:string,options:RequestInit={}):Promise<T>{
  const res=await fetch(`/api${path}`,{...options,headers:{'content-type':'application/json',...options.headers}});
  let data:any;
  try{data=await res.json();}catch{throw new Error(`Server error (${res.status}). Is the API running?`);}
  if(!res.ok)throw new Error(data?.error||`Request failed (${res.status})`);
  return data as T;
}
export const getSnapshot=()=>request<Snapshot>('/bootstrap');
export const put=<T=unknown>(url:string,body:unknown)=>request<T>(url,{method:'PUT',body:JSON.stringify(body)});
export const post=<T=unknown>(url:string,body:unknown={})=>request<T>(url,{method:'POST',body:JSON.stringify(body)});
export const patch=<T=unknown>(url:string,body:unknown)=>request<T>(url,{method:'PATCH',body:JSON.stringify(body)});
export const del=<T=unknown>(url:string)=>request<T>(url,{method:'DELETE',body:'{}'});
