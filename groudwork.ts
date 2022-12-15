import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { Vocabulary } from "@pulumi/aws/connect";

export interface vpcOptions {
    name: string;
    cidrBlock: string;
    enableDnsHostname: boolean;
    tags?: {};
}

export interface subnetOptions {
    name: string;
    cidrBlock: string;
    availabilityZone: string;
    assignPublicAddress: boolean;
}

export interface groundWorkOptions {
    vpcOptions: vpcOptions;
    publicSubnetsOptions: subnetOptions[];
    privateSubnetsOptions: subnetOptions[];
}

export class groundWork extends pulumi.ComponentResource {

    private groundWorkOptions: groundWorkOptions;

    private defaultTags: {} = {
        Package: "groundwork_aws"
    }

    constructor(name: string, groundWorkOptions: groundWorkOptions, opts?: pulumi.ResourceOptions) {
        super("modules:GroundWork", name, {}, opts);

        this.groundWorkOptions = groundWorkOptions

        // Main VPC
        const mainVpc = this.createVpc(this.groundWorkOptions.vpcOptions);

        // Public network
        const internetGateway = this.createInternetGateway(mainVpc)
        const publicSubnets = this.createSubnets(mainVpc, this.groundWorkOptions.publicSubnetsOptions);

        // Private network
        const privateSubnets = this.createSubnets(mainVpc, this.groundWorkOptions.privateSubnetsOptions);
        const natGatewayAssociation = this.createNatGateways(privateSubnets);
    }

    private createVpc(vpc: vpcOptions): aws.ec2.Vpc {
        const awsVpc = new aws.ec2.Vpc(vpc.name, {
            cidrBlock: vpc.cidrBlock,
            instanceTenancy: "default",
            enableDnsHostnames: vpc.enableDnsHostname,

            tags: {
                Name: vpc.name
            }
        });

        return awsVpc;
    }

    private createInternetGateway(vpc: aws.ec2.Vpc){
        const awsInternetGateway = new aws.ec2.InternetGateway("gw", {
            vpcId: vpc.id,
            tags: {
                Name: "internet-gateway",
            },
        });
        
        return awsInternetGateway;
    }

    private createSubnets(vpc: aws.ec2.Vpc, subnets: subnetOptions[]) {
        let createdSubnets: aws.ec2.Subnet[] = [];
        for(const subnet of subnets){
            const awsSubnet = new aws.ec2.Subnet(subnet.name, {
                vpcId: vpc.id,
                cidrBlock: subnet.cidrBlock,
                availabilityZone: subnet.availabilityZone,
                mapPublicIpOnLaunch: subnet.assignPublicAddress,

                tags: {
                    Name: subnet.name,
                }
            });

            createdSubnets.push(awsSubnet);
        }

        return createdSubnets;
    }

    private createNatGateways(subnets: aws.ec2.Subnet[]){
        let createdNatGateways: aws.ec2.NatGateway[] = [];
        for(const [i, subnet] of subnets.entries()){

            const elasticIp = new aws.ec2.Eip(`elasticIp-${i}`);

            const awsNatGateway = new aws.ec2.NatGateway(`natgatewayPrivateSubnet-${i}`, {
                allocationId: elasticIp.id,
                subnetId: subnet.id,
                tags: {
                    Name: `gw-NAT`,
                },
            });

            createdNatGateways.push(awsNatGateway);
        }

        return createdNatGateways;
    }

}