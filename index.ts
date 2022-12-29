import * as grondwork from "./groudwork"

const vpcDefinition: grondwork.vpcOptions = {
    name: "EKS",
    cidrBlock: "10.0.0.0/16"
}

const publicSubnetsDefinition: grondwork.subnetOptions[] = [{
    name: "EKS-Public-1",
    cidrBlock: "10.0.0.0/20",
    availabilityZone: "eu-central-1a",
    assignPublicAddress: true
}, {
    name: "EKS-Public-2",
    cidrBlock: "10.0.64.0/20",
    availabilityZone: "eu-central-1a",
    assignPublicAddress: true
}]

const privateSubnetsDefinition: grondwork.subnetOptions[] = [{
    name: "EKS-Private-1",
    cidrBlock: "10.0.128.0/20",
    availabilityZone: "eu-central-1b",
    assignPublicAddress: false
}, {
    name: "EKS-Private-2",
    cidrBlock: "10.0.192.0/20",
    availabilityZone: "eu-central-1b",
    assignPublicAddress: false    
}]

const groundworkDefinition: grondwork.groundWorkOptions = {
    vpcOptions: vpcDefinition,
    publicSubnetsOptions: publicSubnetsDefinition,
    privateSubnetsOptions: privateSubnetsDefinition
}

const awsGroudwork = new grondwork.groundWork("eksGroundwork", groundworkDefinition);

export const awsVpcInfo = awsGroudwork.exportVpcInfos();