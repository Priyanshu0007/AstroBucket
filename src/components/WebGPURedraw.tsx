import React, { useEffect, useRef } from 'react';

interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): string;
}

interface GPUAdapter {
  requestDevice(): Promise<GPUDevice | null>;
}

interface GPUDevice {
  queue: {
    writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: BufferSource): void;
    submit(commandBuffers: GPUCommandBuffer[]): void;
  };
  createShaderModule(desc: { code: string }): GPUShaderModule;
  createBindGroupLayout(desc: { entries: { binding: number; visibility: number; buffer: { type: string } }[] }): GPUBindGroupLayout;
  createPipelineLayout(desc: { bindGroupLayouts: GPUBindGroupLayout[] }): GPUPipelineLayout;
  createRenderPipeline(desc: object): GPURenderPipeline;
  createBuffer(desc: { size: number; usage: number }): GPUBuffer;
  createBindGroup(desc: { layout: GPUBindGroupLayout; entries: { binding: number; resource: { buffer: GPUBuffer } }[] }): GPUBindGroup;
  createCommandEncoder(): GPUCommandEncoder;
}

interface GPUShaderModule {}
interface GPUBindGroupLayout {}
interface GPUPipelineLayout {}
interface GPURenderPipeline {}
interface GPUBuffer {}
interface GPUBindGroup {}
interface GPUCommandBuffer {}
interface GPUCommandEncoder {
  beginRenderPass(desc: {
    colorAttachments: {
      view: GPUTextureView;
      clearValue: { r: number; g: number; b: number; a: number };
      loadOp: string;
      storeOp: string;
    }[];
  }): GPURenderPassEncoder;
  finish(): GPUCommandBuffer;
}
interface GPURenderPassEncoder {
  setPipeline(pipeline: GPURenderPipeline): void;
  setBindGroup(index: number, bindGroup: GPUBindGroup): void;
  draw(vertexCount: number): void;
  end(): void;
}
interface GPUCanvasContext {
  configure(desc: { device: GPUDevice; format: string; alphaMode: string }): void;
  getCurrentTexture(): { createView(): GPUTextureView };
}
interface GPUTextureView {}

declare global {
  interface Window {
    GPUShaderStage?: {
      VERTEX: number;
      FRAGMENT: number;
      COMPUTE: number;
    };
    GPUBufferUsage?: {
      MAP_READ: number;
      MAP_WRITE: number;
      COPY_SRC: number;
      COPY_DST: number;
      INDEX: number;
      VERTEX: number;
      UNIFORM: number;
      STORAGE: number;
    };
  }

  interface Navigator {
    gpu?: GPU;
  }

  interface HTMLCanvasElement {
    getContext(contextId: 'webgpu'): GPUCanvasContext | null;
  }
}

/**
 * WebGPURedraw.tsx
 * 
 * An interactive canvas component inspired by William Candillon's Redraw vector engine.
 * It renders glowing, morphing vector lines and fluid backgrounds.
 * 
 * Performance design:
 * - Uses WebGPU (WGSL) when available for hardware-accelerated computation.
 * - Falling back seamlessly to WebGL when WebGPU is disabled or unsupported.
 * - Updates shader uniforms on cursor hover/movement for dynamic interaction.
 */

export const WebGPURedraw: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;
    let cleanup: () => void = () => {};

    // Tracking mouse movements relative to window size
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Set initial canvas resolution
    const resizeCanvas = () => {
      if (!canvas) return;
      canvas.width = canvas.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initial mouse state (center of the screen)
    mouseRef.current.targetX = window.innerWidth / 2;
    mouseRef.current.targetY = window.innerHeight / 2;
    mouseRef.current.x = mouseRef.current.targetX;
    mouseRef.current.y = mouseRef.current.targetY;

    // --- WebGPU Implementation ---
    const initWebGPU = async () => {
      if (!navigator.gpu) {
        console.warn('WebGPU not supported in this browser. Falling back to WebGL.');
        return false;
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.warn('No WebGPU adapter found. Falling back to WebGL.');
        return false;
      }

      const device = await adapter.requestDevice();
      if (!device) {
        console.warn('Failed to request WebGPU device. Falling back to WebGL.');
        return false;
      }
      const context = canvas.getContext('webgpu');
      if (!context) {
        console.warn('Failed to get WebGPU context. Falling back to WebGL.');
        return false;
      }

      // Configure the WebGPU canvas context
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: 'opaque',
      });

      // WGSL Shader Modules (Vertex and Fragment Shaders)
      const shaderModule = device.createShaderModule({
        code: `
          struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) uv: vec2<f32>,
          };

          @vertex
          fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
            // Full-screen triangle coordinates
            var pos = array<vec2<f32>, 3>(
              vec2<f32>(-1.0, -1.0),
              vec2<f32>(3.0, -1.0),
              vec2<f32>(-1.0, 3.0)
            );
            var out: VertexOutput;
            out.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
            out.uv = pos[vertexIndex] * 0.5 + vec2<f32>(0.5, 0.5);
            return out;
          }

          struct Uniforms {
            time: f32,
            width: f32,
            height: f32,
            mouseX: f32,
            mouseY: f32,
          };

          @group(0) @binding(0) var<uniform> uniforms: Uniforms;

          @fragment
          fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
            let resolution = vec2<f32>(uniforms.width, uniforms.height);
            let mouse = vec2<f32>(uniforms.mouseX, uniforms.mouseY);
            
            // Normalize screen space coords
            let p = (uv * 2.0 - vec2<f32>(1.0)) * (resolution / min(resolution.x, resolution.y));
            let m = (mouse / resolution * 2.0 - vec2<f32>(1.0)) * (resolution / min(resolution.x, resolution.y));
            
            let dist = length(p - m);
            
            // Vector wave distortion mimicking Redraw vector curves
            let wave = sin(p.x * 1.5 + uniforms.time * 0.3) * cos(p.y * 1.5 - uniforms.time * 0.2);
            let p_dist = p + vec2<f32>(wave * 0.2, cos(p.x * 1.0 + uniforms.time * 0.4) * 0.15);
            
            // Calculate distance fields for vector lines
            let r1 = abs(sin(p_dist.x * 1.1 + uniforms.time * 0.15) * 0.4 - p_dist.y);
            let r2 = abs(cos(p_dist.y * 1.3 - uniforms.time * 0.2) * 0.35 - p_dist.x);
            
            // Inverse distance fields create the smooth neon glow
            let glow1 = 0.012 / (r1 + 0.09);
            let glow2 = 0.012 / (r2 + 0.09);
            
            // Curated gradient colors aligning with AstroBucket brand colors (Purple & Blue)
            let colorBlue = vec3<f32>(0.18, 0.45, 0.96) * glow1;
            let colorPurple = vec3<f32>(0.61, 0.28, 0.97) * glow2;
            
            var bg = vec3<f32>(0.03, 0.03, 0.06) * (1.0 - length(p) * 0.35);
            bg = bg + vec3<f32>(0.08, 0.15, 0.3) * (0.008 / (dist + 0.18));
            
            var finalColor = colorBlue + colorPurple + bg;
            
            // Adding a vignette overlay
            let vignette = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
            let vig = clamp(pow(16.0 * vignette, 0.2), 0.0, 1.0);
            finalColor = finalColor * vig;
            
            return vec4<f32>(finalColor, 1.0);
          }
        `,
      });

      // Declare WebGPU numeric masks for typescript environments without global types
      const GPUShaderStage = window.GPUShaderStage || {
        VERTEX: 0x1,
        FRAGMENT: 0x2,
        COMPUTE: 0x4,
      };
      const GPUBufferUsage = window.GPUBufferUsage || {
        MAP_READ: 0x1,
        MAP_WRITE: 0x2,
        COPY_SRC: 0x4,
        COPY_DST: 0x8,
        INDEX: 0x10,
        VERTEX: 0x20,
        UNIFORM: 0x40,
        STORAGE: 0x80,
      };

      // Pipeline layout setting bindings
      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' },
          },
        ],
      });

      const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      });

      const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{ format }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      // Uniform buffer size (5 floats = 20 bytes, padded to 256 for alignment)
      const uniformBufferSize = 256;
      const uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
        ],
      });

      const startTime = Date.now();

      // Render Loop
      const frame = () => {
        if (!canvas) return;

        // Smooth mouse damping interpolation
        mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
        mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

        const time = (Date.now() - startTime) / 1000.0;
        
        // Populate typed array with uniforms data
        const uniformData = new Float32Array([
          time,
          canvas.width,
          canvas.height,
          mouseRef.current.x * window.devicePixelRatio,
          (window.innerHeight - mouseRef.current.y) * window.devicePixelRatio, // Flip Y axis for WebGPU/WebGL
        ]);

        device.queue.writeBuffer(uniformBuffer, 0, uniformData);

        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const renderPassDescriptor = {
          colorAttachments: [
            {
              view: textureView,
              clearValue: { r: 0.03, g: 0.03, b: 0.06, a: 1.0 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.draw(3); // Render 1 full-screen triangle
        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);
        animationFrameId = requestAnimationFrame(frame);
      };

      animationFrameId = requestAnimationFrame(frame);
      
      cleanup = () => {
        cancelAnimationFrame(animationFrameId);
      };

      return true;
    };

    // --- WebGL Fallback Implementation ---
    const initWebGL = () => {
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
      if (!gl) {
        console.error('WebGL not supported on this device.');
        return;
      }

      // Vertex shader source
      const vsSource = `
        attribute vec2 position;
        varying vec2 v_uv;
        void main() {
          v_uv = position * 0.5 + 0.5;
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `;

      // Fragment shader source (matches the WGSL math output closely)
      const fsSource = `
        precision highp float;
        varying vec2 v_uv;
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;

        void main() {
          vec2 p = (v_uv * 2.0 - 1.0) * (u_resolution / min(u_resolution.x, u_resolution.y));
          vec2 m = (u_mouse / u_resolution * 2.0 - 1.0) * (u_resolution / min(u_resolution.x, u_resolution.y));
          
          float dist = length(p - m);
          
          // Vector wave distortion mimicking Redraw
          float wave = sin(p.x * 1.5 + u_time * 0.3) * cos(p.y * 1.5 - u_time * 0.2);
          vec2 p_dist = p + vec2(wave * 0.2, cos(p.x * 1.0 + u_time * 0.4) * 0.15);
          
          // Calculate distance fields for vector lines
          float r1 = abs(sin(p_dist.x * 1.1 + u_time * 0.15) * 0.4 - p_dist.y);
          float r2 = abs(cos(p_dist.y * 1.3 - u_time * 0.2) * 0.35 - p_dist.x);
          
          // Neon glow calculations
          float glow1 = 0.012 / (r1 + 0.09);
          float glow2 = 0.012 / (r2 + 0.09);
          
          vec3 colorBlue = vec3(0.18, 0.45, 0.96) * glow1;
          vec3 colorPurple = vec3(0.61, 0.28, 0.97) * glow2;
          
          vec3 bg = vec3(0.03, 0.03, 0.06) * (1.0 - length(p) * 0.35);
          bg = bg + vec3(0.08, 0.15, 0.3) * (0.008 / (dist + 0.18));
          
          vec3 finalColor = colorBlue + colorPurple + bg;
          
          // Vignette
          float vignette = v_uv.x * v_uv.y * (1.0 - v_uv.x) * (1.0 - v_uv.y);
          float vig = clamp(pow(16.0 * vignette, 0.2), 0.0, 1.0);
          finalColor = finalColor * vig;
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `;

      // Helper to compile shaders
      const createShader = (glContext: WebGLRenderingContext, type: number, source: string) => {
        const shader = glContext.createShader(type);
        if (!shader) return null;
        glContext.shaderSource(shader, source);
        glContext.compileShader(shader);
        if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
          console.error('Shader compile error:', glContext.getShaderInfoLog(shader));
          glContext.deleteShader(shader);
          return null;
        }
        return shader;
      };

      const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
      const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
      if (!vs || !fs) return;

      const program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return;
      }

      gl.useProgram(program);

      // Create a full-screen quad (2 triangles)
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]), gl.STATIC_DRAW);

      const positionLocation = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      // Uniform Locations
      const timeLocation = gl.getUniformLocation(program, 'u_time');
      const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
      const mouseLocation = gl.getUniformLocation(program, 'u_mouse');

      const startTime = Date.now();

      const render = () => {
        if (!canvas) return;

        // Smooth mouse damping
        mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
        mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

        const time = (Date.now() - startTime) / 1000.0;

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.uniform1f(timeLocation, time);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        gl.uniform2f(mouseLocation, mouseRef.current.x * window.devicePixelRatio, (window.innerHeight - mouseRef.current.y) * window.devicePixelRatio);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        animationFrameId = requestAnimationFrame(render);
      };

      animationFrameId = requestAnimationFrame(render);

      cleanup = () => {
        cancelAnimationFrame(animationFrameId);
        gl.deleteBuffer(positionBuffer);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
      };
    };

    // Attempt to start WebGPU, fallback to WebGL if unsuccessful
    initWebGPU().then((success) => {
      if (!success) {
        initWebGL();
      }
    });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', resizeCanvas);
      cleanup();
    };
  }, []);

  return (
    <div className="canvas-bg-container">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
    </div>
  );
};
