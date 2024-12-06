export interface Exploit{
    vulnerability_id: string,
    title: string,
    description: string, 
    publication_date: Date,
    source_link: string, 
    score: number,
    type: string 
}

export interface Service{
    ipAddress: string, 
    domain: string 
}

export interface ExpectedOutput{
    runCommand: string, 
    end: boolean,
    verdict: string 
}

export interface Message{
    role: string 
    content: string 
}

export interface Execution{
    command: string 
    output: string 
}