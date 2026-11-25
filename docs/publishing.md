# How posts go out

Every account is a row in `channels`. Its `tool` says how an approved post leaves the HQ.
Adding Irina's Instagram, a second Metricool or a new page means changing one row, not the app.

| tool | What happens to an `approved` post | Who presses Publish |
| --- | --- | --- |
| `typefully` / `buffer` / `metricool` | Monday 12:00 run schedules it through the tool; writes back `scheduled` + `external_url` | The tool, at the scheduled time |
| `browser` | Goes into the **Ready to post** queue (`ready_to_post` view). When Arcadie or Irina is at the computer and says "post it", Claude opens `post_url` in their browser, pastes the caption, uploads the photos and stops on the Publish button | The person (or Claude, if they say "you press it" for that post) |
| `manual` | Same queue; the HQ shows the caption with a Copy button and the photos to save | The person, in the app |

## Today's channels

| Channel | Tool now | Next step to automate |
| --- | --- | --- |
| BF IG + FB, BF TikTok | Metricool | — |
| BF LinkedIn page | Buffer | — |
| Arcadie LinkedIn | Typefully (372499) | — |
| Arcadie IG (@arkyk) | manual | Check whether Buffer can still post to it (Creator account), else `browser` |
| Arcadie FB | manual | `browser` once Arcadie says posting through his browser is OK |
| Irina LinkedIn / IG / FB | manual | Irina connects her own Metricool (or Buffer/Typefully) and shares access → set `tool`, `tool_ref`, `connected = true` |

## Browser posting: the rules
- Only for channels set to `browser`, and only while the person is there. The Monday run never posts through a browser on its own: it sends "2 posts ready to post in your browser" instead.
- Claude fills the post and stops at Publish. It presses Publish only when the person says so for that post.
- Never typing passwords or one-time codes: the browser must already be signed in.
- After posting, the post's `external_url` is saved and its status becomes `published`.

## Adding a channel later
```sql
update channels set tool = 'metricool', tool_ref = '<brand id>', connected = true
where id = 'irina_ig';
```
New networks or accounts: `insert into channels (id, owner, network, label, tool, ...)`.
