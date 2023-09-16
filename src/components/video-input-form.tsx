import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { FileVideo, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import {fetchFile} from '@ffmpeg/util'
import { api } from "@/lib/axios";


type Status = 'waiting' | 'converting' | 'uploading' | 'generating' | 'sucess'

const statusMessages={
    converting:'Convertendo',
    generating:'Transcrevendo',
    uploading:'Carregando',
    sucess:'Sucesso',
}


interface VideoInputFormProps{
    onVideoUploaded:(id:string)=> void
}

export function VideoInputForm(props: VideoInputFormProps){
    const [videoFile,setVideoFile]=useState<File | null>(null)
    const promptInputRef = useRef<HTMLTextAreaElement>(null)
    const [status, setStatus] = useState<Status>('waiting')

    function handleFileSelected(event: ChangeEvent<HTMLInputElement>){
        const {files} = event.currentTarget 
        if(!files){
            return
        }

        const selectedFile = files[0]
        setVideoFile(selectedFile)
    }

   async function handleUploadVideo(event: FormEvent<HTMLFormElement>){
        event.preventDefault()

        const prompt= promptInputRef.current?.value

        if(!videoFile){
            return
        }

        setStatus('converting')
        
        //Converte video em audio

        const audioFile = await convertVideoToAudio(videoFile)

        const data = new FormData()

        data.append('file', audioFile)

        setStatus('uploading')

        const response = await api.post('/videos',data)

        const videoId = response.data.video.id

        setStatus('generating')
        await api.post(`/videos/${videoId}/transcription`,{
            prompt,
        })
        setStatus('sucess')
        console.log('Finalizado')
        props.onVideoUploaded(videoId)

    }        
        async function convertVideoToAudio(video:File){
            console.log('Convert started')

            const ffmpeg= await getFFmpeg()

            await ffmpeg.writeFile('input.mp4', await fetchFile(video))

            ffmpeg.on('log', log =>{console.log(log)})
            ffmpeg.on('progress', progress => {
                console.log('Convert Progress: ' + Math.round(progress.progress * 100))
            })

            await ffmpeg.exec([
            '-i',
            'input.mp4',
            '-map',
            '0:a',
            '-b:a',
            '20k',
            '-acodec',
            'libmp3lame',
            'output.mp3'
            ])

            const data = await ffmpeg.readFile('output.mp3')

            const audioFileBlob = new Blob([data],{type:'audio/mpef'})
            const audioFile = new File([audioFileBlob],'audio.mp3',{
                type:'audio/mpeg',
            })

            console.log('Convert finisehd')

            return audioFile

        }

    const previewURL = useMemo(()=>{
        if(!videoFile){
            return null
        }
        return URL.createObjectURL(videoFile)
    },[videoFile])

    return (
    <form onSubmit={handleUploadVideo} className="space-y-6 ">
            <label htmlFor="video" className="relative border flex rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-primary/5">
              {
              previewURL ? (
                <video src={previewURL} controls={false} className="pointer-events-none inset-0"/>
              ) : (
                <>
                    <FileVideo className="w-4 h-4"/>
                    Selecione um video
                </>
              )}
              
            </label>
            <input type="file" id="video" accept="video/mp4" className="sr-only" onChange={handleFileSelected}/>
            
            <Separator/>

            <div className="space-y-1">
              <Label htmlFor="transcription_prompt">Prmpt de transcrição</Label>
              <Textarea disabled={status!='waiting'} ref={promptInputRef} id="transcription_prompt" className="h-20 leading-relaxed resize-none" placeholder="Inclua palavras chave do video separadas por virgula"/>
            </div>

            <Button disabled={status!='waiting'} type="submit" className="w-full data-[sucess=true]:bg-emerald-400" data-sucess={status == 'sucess'}>
              {status == 'waiting' ? (
                <>
                    Carregar video
                    <Upload className="w-4 h-4 ml-2"/>
                </>
              ) : statusMessages[status]}
            </Button>

          </form>
    )
}
