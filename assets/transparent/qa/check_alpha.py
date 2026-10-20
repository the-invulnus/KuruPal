from pathlib import Path
from PIL import Image
import json,subprocess
root=Path(__file__).resolve().parent.parent
report=[]
for p in sorted(root.glob('*.webm')):
    meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_name,width,height:stream_tags:format=duration','-of','json',str(p)]))
    stream=next(s for s in meta['streams'] if s['codec_name'] in ('vp8','vp9'))
    decoder='libvpx-vp9' if stream['codec_name']=='vp9' else 'libvpx'
    raw=subprocess.check_output(['ffmpeg','-v','error','-c:v',decoder,'-i',str(p),'-vf','alphaextract,scale=32:32:flags=area','-pix_fmt','gray','-f','rawvideo','-'])
    assert raw and len(raw)%1024==0,p.name
    frames=[raw[i:i+1024] for i in range(0,len(raw),1024)]
    assert min(raw)==0 and max(raw)==255,(p.name,min(raw),max(raw))
    duration=float(meta['format']['duration'])
    snapshots=[]
    for label,t in [('start',0),('middle',duration/2),('end',max(0,duration-.2))]:
        out=root/'qa'/(p.stem+'-'+label+'.png')
        subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-c:v',decoder,'-i',str(p),'-frames:v','1',str(out)],check=True)
        im=Image.open(out).convert('RGBA');a=im.getchannel('A');hist=a.histogram()
        snapshots.append({'frame':label,'alpha_range':list(a.getextrema()),'transparent_pixels':hist[0],'opaque_pixels':hist[255]})
        if label=='end':
            bg=Image.new('RGBA',im.size,(47,64,84,255));bg.alpha_composite(im);bg.convert('RGB').save(out.with_suffix('.jpg'))
    row={'file':p.name,'bytes':p.stat().st_size,'codec':stream['codec_name'],'width':stream['width'],'height':stream['height'],'duration':duration,'decoded_alpha_frames':len(frames),'frames_with_transparency':sum(min(f)==0 for f in frames),'snapshots':snapshots}
    report.append(row);print(p.name,'Alpha OK',len(frames),'帧')
(root/'qa'/'alpha-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('共校验',len(report),'份视频')
