/** Best-effort duplicate/cooldown guard per warm server instance; not a global spending cap. */
const attempts = new Map<string, number>();
export function reserveShowcaseAttempt(id:string):boolean {
 const now=Date.now();for(const [key,time] of attempts)if(time<now-600000)attempts.delete(key);
 if(attempts.has(id)||attempts.size>=3)return false;
 attempts.set(id,now);return true;
}
