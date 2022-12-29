import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface VpcOptions {
    name: string;
    cidrBlock: string;
    tags?: {};
}

export interface SubnetOptions {
    name: string;
    cidrBlock: string;
    availabilityZone: string;
    assignPublicAddress: boolean;
    tags?: {};
}

export interface GroundWorkOptions {
    vpcOptions: VpcOptions;
    publicSubnetsOptions: SubnetOptions[];
    privateSubnetsOptions: SubnetOptions[];
}

export class GroundWork extends pulumi.ComponentResource {

    private mainVpc: aws.ec2.Vpc;
    private internetGateway: aws.ec2.InternetGateway;
    private publicSubnets: aws.ec2.Subnet[];
    private privateSubnets: aws.ec2.Subnet[];
    private publicRouteTable: aws.ec2.RouteTable;
    private privateRouteTable: aws.ec2.RouteTable;
    private awsNatGateway: aws.ec2.NatGateway;
    private groundWorkOptions: GroundWorkOptions;

    private defaultTags: {} = {
        "Package": "groundwork_aws",
        "Created-By": "pulumi"
    }

    constructor(name: string, groundWorkOptions: GroundWorkOptions, opts?: pulumi.ResourceOptions) {
        super("modules:GroundWork", name, {}, opts);

        this.groundWorkOptions = groundWorkOptions

        // Main VPC
        this.createVpc();

        // Public network
        this.createInternetGateway();
        this.publicSubnets = this.createSubnets(this.groundWorkOptions.publicSubnetsOptions, true);

        // Private network
        this.createNatGateways(this.publicSubnets[0]);
        this.privateSubnets = this.createSubnets(this.groundWorkOptions.privateSubnetsOptions, false);
    }

    private createVpc() {
        this.mainVpc = new aws.ec2.Vpc(this.groundWorkOptions.vpcOptions.name, {
            cidrBlock: this.groundWorkOptions.vpcOptions.cidrBlock,
            instanceTenancy: "default",
            enableDnsHostnames: true,

            tags: {
                Name: `${this.groundWorkOptions.vpcOptions.name}-Vpc`
            }
        }, { parent: this });
    }

    private createInternetGateway() {
        this.internetGateway = new aws.ec2.InternetGateway("internetGateway", {
            vpcId: this.mainVpc.id,
            tags: {
                Name: `${this.groundWorkOptions.vpcOptions.name}-Internet-Gateway`,
            },
        }, { parent: this.mainVpc });

        this.publicRouteTable = new aws.ec2.RouteTable("publicRouteTable", {
            vpcId: this.mainVpc.id,
            tags: Object.assign({}, this.defaultTags, {
                Name: `${this.groundWorkOptions.vpcOptions.name}-Public-RouteTable`,
            }),
        }, { parent: this.internetGateway });

        const privateroute = new aws.ec2.Route('privateRoute', {
            routeTableId: this.publicRouteTable.id,
            gatewayId: this.internetGateway.id,
            destinationCidrBlock: "0.0.0.0/0",
        }, { parent: this.publicRouteTable })

    }

    private createSubnets(subnets: SubnetOptions[], isPublic: boolean): aws.ec2.Subnet[] {
        let createdSubnets: aws.ec2.Subnet[] = [];

        for(const [i, subnet] of subnets.entries()){

            const awsSubnet = new aws.ec2.Subnet(subnet.name, {
                vpcId: this.mainVpc.id,
                cidrBlock: subnet.cidrBlock,
                availabilityZone: subnet.availabilityZone,
                mapPublicIpOnLaunch: subnet.assignPublicAddress,
                tags: Object.assign({}, this.defaultTags, {
                    Name: subnet.name,
                })
            }, { parent: this.mainVpc });

            if(isPublic){
                const routeTableAssociation = new aws.ec2.RouteTableAssociation(`publicRoutetableAssociation-${i+1}`, {
                    subnetId: awsSubnet.id,
                    routeTableId: this.publicRouteTable.id,
                }, { parent: awsSubnet });
            } else {
                const routeTableAssociation = new aws.ec2.RouteTableAssociation(`privateRoutetableAssociation-${i+1}`, {
                    subnetId: awsSubnet.id,
                    routeTableId: this.privateRouteTable.id,
                }, { parent: awsSubnet });
            }

            createdSubnets.push(awsSubnet);
        }

        return createdSubnets;
    }

    private createNatGateways(publicSubnet: aws.ec2.Subnet) {

        const elasticIp = new aws.ec2.Eip("elasticIp", {
            tags: {
                Name: `${this.groundWorkOptions.vpcOptions.name}-ElasticIp`
            }
        }, { parent: publicSubnet });

        this.awsNatGateway = new aws.ec2.NatGateway("natGatewayPrivateSubnet", {
            allocationId: elasticIp.id,
            subnetId: publicSubnet.id,
            tags: Object.assign({}, this.defaultTags, {
                Name: `${this.groundWorkOptions.vpcOptions.name}-Nat-Gateway`,
            }),
        }, { parent: publicSubnet });

        this.privateRouteTable = new aws.ec2.RouteTable("privateRoutetable", {
            vpcId: this.mainVpc.id,
            tags: Object.assign({}, this.defaultTags, {
                Name: `${this.groundWorkOptions.vpcOptions.name}-Private-RouteTable`,
            }),
        }, { parent: this.awsNatGateway });

        const privateroute = new aws.ec2.Route('privateRoute', {
            routeTableId: this.privateRouteTable.id,
            natGatewayId: this.awsNatGateway.id,
            destinationCidrBlock: "0.0.0.0/0",
        }, { parent: this.privateRouteTable })
    }

    private returnOnlyId(resources: any[]): pulumi.Output<string>[] {
        let resourcesId: pulumi.Output<string>[] = []
        for(const resource of resources){
            resourcesId.push(resource.id);
        }
        return resourcesId
    }

    public exportVpcInfos() {
        return {
            vpcId: this.mainVpc.id,
            internetGatewayid: this.internetGateway.id,
            publicSubnetsId: this.returnOnlyId(this.publicSubnets),
            privateSubnetsId: this.returnOnlyId(this.privateSubnets),
            natGatewayIds: this.awsNatGateway.id
        }
    }

}