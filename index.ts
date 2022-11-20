import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface vpcInterface {
    name: string;
    cidrBlock: string;
    enableDnsHostname: boolean;
    tags?: {};
}

const defaultTags: {} = {
    Package: "groundwork_aws"
}

function createVpc(vpcData: vpcInterface): aws.ec2.Vpc {

    let vpcTags: {} = {};
    if(vpcData.tags == undefined){
        vpcTags = defaultTags
    }
    else{
        vpcTags = Object.assign(vpcData.tags, defaultTags);
    }
    
    const vpc = new aws.ec2.Vpc(vpcData.name, {
        cidrBlock: vpcData.cidrBlock,
        instanceTenancy: "default",
        enableDnsHostnames: vpcData.enableDnsHostname,
        tags: vpcTags,
    });

    return vpc
}

export function createGroundWork(vpcData: vpcInterface) {
    const mainVpc = createVpc(vpcData);
}

createGroundWork({name: "iac-vpc", cidrBlock: "10.0.0.0/16", enableDnsHostname: true, tags: {Name: "iac-vpc"}})