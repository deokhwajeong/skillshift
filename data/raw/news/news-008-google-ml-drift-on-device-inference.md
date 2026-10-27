---
id: news-008
title: "Google ML Drift Accelerates On-Device AI Inference Across Diverse GPUs"
source: InfoQ
url: https://www.infoq.com/news/2026/10/google-ml-drift/
published_date: 2026-10-25
source_type: trade
---

Google has released ML Drift, an open-source, cross-platform GPU compute engine designed for on-device AI and machine learning inference. Licensed under Apache 2.0, it abstracts the complexities of different GPU hardware and low-level APIs, supporting OpenGL ES, OpenCL, Metal, and WebGPU.

ML Drift is the core GPU acceleration engine that powers LiteRT. By open-sourcing it, Google is enabling developers to build custom graphics and inference runtimes for applications ranging from traditional computer vision, audio, and depth processing to generative AI.

One of ML Drift's main goal is simplifying access to the diverse GPU hardware that developers encounter when creating applications for edge devices.

Developers are faced with a wide range of GPU architectures, driver versions, and low-level APIs, not knowing a priori on which specific hardware the application will run on.

ML Drift aims to establish a new foundation for portability and performance, Google says, delivering "stability for traditional ML and peak performance for the most advanced generative AI".

To achieve this, ML Drift introduces several technical improvements over the legacy TFLite GPU delegate, including unified shaders through tensor virtualization, extensible custom operations, and five-dimensional tensor support. It also incorporates hardware-specific optimizations for GPUs from Arm, Intel, and Qualcomm Technologies to "maximize hardware utilization across modern GPUs".

ML Drift extends desktop support for inference on Windows and Linux through Dawn, Chromium's WebGPU implementation, while retaining native Metal backend support on macOS. Dawn provides a unified API model leveraging WebGPU's hardware abstraction layer, avoiding the need to interface directly with platform-specific graphics APIs such as DirectX and Vulkan.

Google benchmarked ML Drift using Gemma models on developer-grade workstation hardware, reporting a 12% lower memory overhead compared to other frameworks, including llama.cpp and MLX LM. The company also emphasized that ML Drift is already running on millions of devices through apps like Chrome, YouTube Shorts, Photos, and Meet.

In YouTube Shorts, ML Drift achieves up to a 40% reduction in average frame latency for segmentation-based effects on Android and iOS. In Google Photos, it speeds up computational photography and segmentation pipelines by up to two second. Adobe Lightroom and Photoshop benefit from performance improvements of up to 30% for selected AI-powered photo-editing features such as Select Subject, Select Sky, and Adaptive Portrait. Finally, Snapchat sees a 30% reduction in model latency for ML-powered face and style-generation effects on Android, enabling the use of larger diffusion models.

Commenting the announcement on LinkedIn, AI/ML engineer Pavithra Agraharam argued that

Native 5D tensor support without layout hacks is a massive win for running spatial and transformer models on edge GPUs. Decoupling logical tensors from physical memory allocations should significantly cut down on memory fragmentation during live inference.

Matthew Charles Vladislav Busel, founder and sole developer of Tensorust, questioned "how it compares with Core ML on recent iPhones for latency and memory, since that is what most of us ship against today", though Google has not provided any comparative figures.

With the release of ML Drift, Google will stop updating the legacy TensorFlow Lite GPU delegate. For backward compatibility with existing models, the company recommends migrating to the LiteRT ML Drift GPU accelerator. Application developers can use the LiteRT ML Drift accelerator, while GPU and system engineers can access its lower level C++ API to construct custom GpuModel compute graphs and write custom shaders.
