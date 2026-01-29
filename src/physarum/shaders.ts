export const PASS_THROUGH_VERTEX = `
varying vec2 vUv;
void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
}
 `

export const RENDER_DOTS_VERTEX = `
uniform sampler2D positionTexture;
uniform vec3 dotSizes;
varying float team;
void main(){
    vec4 posText = texture2D(positionTexture,uv ) ;
    // Treat negative team values as "inactive" particles.
    if (posText.a < -0.5) {
        team = 0.;
        gl_PointSize = 0.;
        gl_Position = vec4(2., 2., 0., 1.);
        return;
    }
    gl_Position=  projectionMatrix * modelViewMatrix * vec4(posText.xy,0.,1.);
    team = posText.a;
    gl_PointSize = dotSizes[int(team)];
}
`

export const RENDER_DOTS_FRAGMENT = `
uniform sampler2D particleTexture;
uniform bool isParticleTexture;
varying float team;
void main(){
    float d = 1.-length( .5 - gl_PointCoord.xy );
    float r = 0.;
    float g = 0.;
    float b = 1.;
    if (team == 0.) {
        r = 1.;
        g= 0.;
        b = 0.;
    } else if (team == 1. ) {
        r = 0.;
        g = 1.;
        b = 0.;
    }
    vec2 coord = gl_PointCoord;
    float sin_factor = sin(0.);
    float cos_factor = cos(0.);
    coord = vec2((coord.x - 0.5) , coord.y - 0.5) * mat2(cos_factor, sin_factor, -sin_factor, cos_factor);

    coord += 0.5;
    if (isParticleTexture){
        gl_FragColor =  vec4( r,g, b ,1.) * texture2D(particleTexture,gl_PointCoord);
    } else {
        gl_FragColor =  vec4( r,g, b ,1.) ;//* texture2D(particleTexture,gl_PointCoord);
    }
}
`

export const DIFFUSE_DECAY_FRAGMENT = `
uniform sampler2D points;
		uniform sampler2D input_texture;
		uniform vec2 resolution;
		uniform float decay;
		varying vec2 vUv;
		void main(){

			vec2 res = 1. / resolution;
			vec3 pixelPoint = texture2D(points, vUv).rgb;
			float pos = pixelPoint.r;
			float pos2 = pixelPoint.g;
			float pos3 = pixelPoint.b;


			//accumulator
			vec3 col = vec3(0.);


			//blur box size
			const float dim = 1.;

			//weight
			float weight = 1. / pow( 2. * dim + 1., 2. ) ;

			for( float i = -dim; i <= dim; i++ ){

				for( float j = -dim; j <= dim; j++ ){

					vec3 val = texture2D( input_texture,  (gl_FragCoord.xy +vec2(i,j)) /resolution ).rgb;
					col += val*weight;

				}
			}


			gl_FragColor =  vec4( max(0.,min(1.,col.r * decay + pos)), max(0.,min(1.,col.g * decay + pos2)), max(0.,min(1.,col.b * decay+ pos3)),1.);


		}`

export const FINAL_RENDER_FRAGMENT = `
uniform sampler2D diffuseTexture;
			uniform sampler2D pointsTexture;
			uniform float isMonochrome;
			uniform float trailOpacity;
			uniform float dotOpacity;
			uniform bool isFlatShading;
			uniform float colorThreshold;
			uniform vec2 resolution;
			uniform vec4 dotColor;
			uniform vec4 trailColor;
			uniform vec3 col0;
			uniform vec3 col1;
			uniform vec3 col2;
			varying vec2 vUv;
			void main(){
				vec2 uv = gl_FragCoord.xy / resolution.xy;
				vec4 trail = texture2D(diffuseTexture, vUv);
				vec4 points = texture2D(pointsTexture,vUv);

			vec4 trailPixel = isMonochrome * vec4(vec3((trail.r + trail.g   + trail.b + trail.a ) / 4. ),trail.a) + (1. - isMonochrome) * trail;
			vec4 dotPixel = isMonochrome * vec4( vec3((points.r + points.g  + points.b + points.a) / 4.),points.a) + (1. - isMonochrome) * points;
			vec4 mixedCol =  trailPixel  * trailOpacity + dotOpacity * dotPixel;
			vec3 customCol = isMonochrome * mixedCol.rgb + (1. - isMonochrome) * (mixedCol.r * col0 + mixedCol.g * col1 + mixedCol.b * col2);
			if (isFlatShading) {

				if (mixedCol.r > colorThreshold && mixedCol.r > mixedCol.b && mixedCol.r > mixedCol.g) {
					customCol =  col0;
				} else if (mixedCol.g > colorThreshold &&  mixedCol.g > mixedCol.b && mixedCol.g > mixedCol.r) {
					customCol = col1;
				} else if (mixedCol.b > colorThreshold && mixedCol.b > mixedCol.g && mixedCol.b > mixedCol.r) {
					customCol = col2;
				}
			}

				// if (trailPixel.rgb == vec3(0.)) {
				// 	gl_FragColor = vec4(1.);
				// }
				// else {


				if (false) {

					float alpha =   (customCol.r + customCol.g  + customCol.b ) / 3.;
				gl_FragColor =
						mix(
						isMonochrome * (vec4(1.) - vec4(customCol,1.)) +
						(1. - isMonochrome) * vec4(customCol,1.),
						vec4(1.),0.5);
				} else {
				gl_FragColor = vec4(customCol,1.);
				}



			}
            `

export const UPDATE_DOTS_FRAGMENT = `
    uniform vec2 resolution;

    uniform float mouseRad;
    uniform float time;
    uniform vec2 mousePos;

    uniform bool isRestrictToMiddle;
    uniform bool isDisplacement;
    uniform vec3 moveSpeed;
    uniform vec3 randChance;
    uniform vec3 rotationAngle;
    uniform vec3 sensorDistance;
    uniform vec3 sensorAngle;
    uniform vec3 infectious;

    uniform vec3 attract0;
    uniform vec3 attract1;
    uniform vec3 attract2;

    uniform vec2 textureDimensions;

    uniform sampler2D diffuseTexture;
    uniform sampler2D mouseSpawnTexture;
    uniform sampler2D pointsTexture;

    //the positions & directions as rg & b values
    uniform sampler2D input_texture;

    varying vec2 vUv;


    const float PI  = 3.14159265358979323846264;
    const float PI2 = PI * 2.;


    float sampleDiffuseTexture(vec2 pos, float team) {
        float val = 0.;
        const float searchArea = 1.;
        vec2 uv = pos / resolution + 0.5;
        for (float i = 0.;i<searchArea * 2. + 1.;i++) {
            for (float j = 0.;j<searchArea * 2. + 1.;j++) {
                vec4 pixel = texture2D(diffuseTexture,(uv + vec2(i - searchArea,j - searchArea) / resolution)).rgba;
                vec3 attract = attract0;
                if (team == 1.) {
                    attract = attract1;
                } else if (team == 2. ) {
                    attract = attract2;
                }
                float pixelVal = pixel.r  * attract.r + pixel.g * attract.g + pixel.b * attract.b;
                val += pixelVal * (1. / pow(2. * searchArea + 1.,2.));
            }
        }
        return val;
    }

    float getDataValue(vec2 uv){
        vec3 pixel = texture2D(pointsTexture,( uv / resolution  + 0.5) ).rgb;
        return pixel.r + pixel.b + pixel.g;

    }

    float rand(vec2 co){
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    vec2 wrapPos(vec2 pos) {
        return fract( (pos.xy + resolution * 0.5) /resolution ) * resolution - resolution * 0.5;
    }

    //attempt to get it working in webgl1. No errors using this but still doesn't work.
    //float getTeamValue(float team,vec3 data) {
    //    if (team == 0.) {
    //        return data.x;
    //    } else if (team == 1.) {
    //        return data.y;
    //    } else if (team == 2. ) {
    //        return data.z;
    //    }
    //}


    void main()	{

        vec2 uv = gl_FragCoord.xy / textureDimensions;
        vec4 tmpPos = texture2D( input_texture, gl_FragCoord.xy / textureDimensions );

        vec4 mouseSpawnPixel = texture2D(mouseSpawnTexture,gl_FragCoord.xy / textureDimensions);
        if (mouseSpawnPixel.r != 0. || mouseSpawnPixel.g != 0. || mouseSpawnPixel.b != 0. || mouseSpawnPixel.a != 0.) {
            gl_FragColor = mouseSpawnPixel;
            return;
        }

        vec2 position = tmpPos.xy ;
        float direction = tmpPos.z;
        float team = tmpPos.a;
        if (team < -0.5) {
            gl_FragColor = tmpPos;
            return;
        }
        int teamInt = int(team);

        bool isPulsing = mod(time + 11. * (1. + team),80.) <40.;
        float pulse = 1. - (abs(mod(time,80.) ) / 40. - .5)/0.5;
        float offset =  isPulsing ? 1. + pulse * .3 : 1.;
        float angDif = sensorAngle[teamInt]  ;
        float leftAng = direction - angDif;
        float rightAng = direction + angDif;

        float sensorDist = sensorDistance[teamInt];
        vec2 leftPos = 	position + vec2( cos(leftAng) , 	sin(leftAng	))  * sensorDist;
        vec2 midPos =	position + vec2( cos(direction) , 	sin(direction)) * sensorDist;
        vec2 rightPos = position + vec2( cos(rightAng) , 	sin(rightAng)) 	* sensorDist;


        float leftVal = sampleDiffuseTexture(leftPos.xy ,team);
        float rightVal = sampleDiffuseTexture(rightPos.xy,team);
        float midVal = sampleDiffuseTexture(midPos.xy,team);





        float rotationAng = rotationAngle[teamInt];

        // if (rand(position)<randChance[teamInt]  ) {
        // direction += rotationAng * sign(rand(gl_FragCoord.xy+position)-0.5) ;
        // } else if (rightVal > midVal && rightVal > leftVal) {
        // 		direction += rotationAng ;
        // } else if (leftVal > midVal && leftVal > rightVal) {
        //     direction -= rotationAng ;
        // }

        if(midVal > rightVal && midVal > leftVal) {
        } else if (midVal < rightVal && midVal < leftVal) {
            direction += (0.5 - floor(rand(position + gl_FragCoord.xy) + 0.5)) * rotationAng;
        } else if (rightVal > midVal && rightVal > leftVal) {
            direction += rotationAng;
        } else if (leftVal > midVal && leftVal > rightVal) {
            direction -= rotationAng;
        }



        if (isRestrictToMiddle && length( position  ) >  155.  * (1. + abs(mod(time * 0.01, 10.)-5.)/5. ) ) {
            direction = atan(position.y, position.x) - PI * 1.;
        }

        vec2 newPosition = position  + vec2(cos(direction),sin(direction)) *  moveSpeed[teamInt] ;



        //stop if new field is already occupied
        if(
            // !isPulsing &&
            isDisplacement && getDataValue(newPosition.xy) > 0. ){
            newPosition.xy = tmpPos.xy;
            direction += PI2 / 2.;
        }

        //push particles away from mouse
        vec2 seg = newPosition.xy - mousePos;
        vec2 dir = normalize(seg);
        float dist = length(seg);
        if (dist< mouseRad) {
            newPosition.xy +=3. *  dir * (50. + mouseRad -  dist) / (50. + mouseRad /  5.);
        }


        //if (newPosition.x < -resolution.x * 0.5 || newPosition.x > resolution.x * 0.5 || newPosition.y < -0.5 * resolution.y || newPosition.y > resolution.y* 0.5) {
        //if (length(newPosition) > 250.  ) {
        //	newPosition.xy = tmpPos.xy;
        //	direction += PI * sign(rand(position.xy)-0.5);
        //}

        //wrap coordinates on screen
        newPosition.xy = wrapPos(newPosition.xy);



        vec4 newPixelColor =texture2D(diffuseTexture, tmpPos.xy / resolution + 0.5);
        bool isBlue = newPixelColor.b > 0.5 && newPixelColor.b > newPixelColor.r && newPixelColor.b > newPixelColor.g;
        bool isRed = newPixelColor.r > 0.5 && newPixelColor.r > newPixelColor.b && newPixelColor.r > newPixelColor.g;
        bool isGreen = newPixelColor.g > 0.5 && newPixelColor.g > newPixelColor.b && newPixelColor.g > newPixelColor.r;
        //Blue infects red
        if (isBlue && team == 0. && infectious.b > 0.) {
            team = 2.;
        } else
        //red infects green
        if (isRed && team == 1. && infectious.r > 0.) {
            team = 0.;
        } else
        //green infects blue
        if (isGreen && team == 2. && infectious.g > 0.) {
            team = 1.;
        }


        gl_FragColor = vec4( newPosition.xy  , direction,  team );

    }`
