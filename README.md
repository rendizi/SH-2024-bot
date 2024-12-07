# SH-2024-BOT 
## 2nd team 

This is an agent of the future- an AI agent, that tries to execute steps to test vulnerability on the service. 

### Get started 

- fill .env according to .env.example 

- build:

```
npm run build
```

- start:

```
npm run start
```

Agent is going to proccess tasks on port 5001. 

### API 
#### /scan 

body:
```
{
    exploit:{
        vulnerability_id: string,
        title: string,
        description: string, 
        publication_date: Date,
        source_link: string, 
        score: number,
        type: string 
    },
    service:{
        ipAddress: string, 
        domain: string 
    },
    token: string 
}
```

response:
```
{ message: "Scanning started!" }
```