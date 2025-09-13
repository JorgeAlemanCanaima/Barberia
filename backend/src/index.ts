import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const app = express()
app.use(cors())
app.use(express.json())
const prisma = new PrismaClient()

app.get('/health', (_,res)=>res.json({ok:true}))

app.get('/services', async (_,res)=>res.json(await prisma.service.findMany({ where:{active:true} })))

app.get('/barbers',  async (_,res)=>res.json(await prisma.barber.findMany({ where:{active:true} })))

app.get('/clients',  async (_,res)=>res.json(await prisma.client.findMany()))

app.post('/clients', async (req,res)=>{ 
  const c=await prisma.client.create({data:req.body}); 
  res.status(201).json(c) 
})

const bookingDto = z.object({ 
  startAt:z.string(), 
  duration:z.number().int().positive(), 
  clientId:z.string(), 
  barberId:z.string(), 
  serviceId:z.string(), 
  price:z.number().positive() 
})

app.get('/bookings', async (req,res)=>{
  const date = req.query.date as string | undefined
  const where = date? { 
    startAt:{ 
      gte:new Date(date+'T00:00:00Z'), 
      lt:new Date(date+'T23:59:59Z') 
    } 
  } : {}
  res.json(await prisma.booking.findMany({ 
    where, 
    include:{client:true,barber:true,service:true} 
  }))
})

app.post('/bookings', async (req,res)=>{
  const parsed = bookingDto.safeParse(req.body); 
  if(!parsed.success) return res.status(400).json(parsed.error)
  
  const { startAt, duration, clientId, barberId, serviceId, price } = parsed.data
  const start = new Date(startAt); 
  const end = new Date(start.getTime()+duration*60000)
  
  const overlap = await prisma.booking.findFirst({ 
    where:{ 
      barberId, 
      startAt:{lt:end}, 
      endAt:{gt:start}, 
      status:{not:'CANCELED'} 
    }
  })
  
  if(overlap) return res.status(409).json({error:'El barbero ya tiene una cita en ese horario'})
  
  const created = await prisma.booking.create({ 
    data:{ 
      startAt:start, 
      endAt:end, 
      duration, 
      clientId, 
      barberId, 
      serviceId, 
      price
    }
  })
  res.status(201).json(created)
})

const port = process.env.PORT || 4000
app.listen(port, ()=>console.log(`API http://localhost:${port}`))
